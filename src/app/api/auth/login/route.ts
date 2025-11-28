import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function uniqueTenantSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.tenant.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${counter++}`;
  }
}

async function provisionTenantPlugins(tenantId: string, planId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include: { plugins: true },
  });
  if (!plan) return;

  for (const link of plan.plugins) {
    await prisma.tenantPlugin.upsert({
      where: { tenantId_pluginId: { tenantId, pluginId: link.pluginId } },
      create: { tenantId, pluginId: link.pluginId, enabled: true },
      update: {},
    });
  }
}

async function ensureUserTenant(userId: string, name: string | null) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "basic" } });
  if (!plan) return null;

  const tenant = await prisma.tenant.create({
    data: {
      name: name || "Workspace",
      slug: await uniqueTenantSlug(name || "workspace"),
      subscriptionPlanId: plan.id,
    },
  });

  await provisionTenantPlugins(tenant.id, plan.id);

  await prisma.user.update({
    where: { id: userId },
    data: {
      defaultTenantId: tenant.id,
      memberships: {
        create: {
          tenantId: tenant.id,
          role: "OWNER",
        },
      },
    },
  });

  return tenant.id;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  let user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          tenant: {
            include: {
              subscriptionPlan: { include: { plugins: { include: { plugin: true } } } },
              pluginToggles: { include: { plugin: true } },
            },
          },
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: "Credenciais incorretas" }, { status: 401 });
  }

  if (!user.memberships.length) {
    const tenantId = await ensureUserTenant(user.id, user.name ?? user.email);
    if (tenantId) {
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          memberships: {
            include: {
              tenant: {
                include: {
                  subscriptionPlan: { include: { plugins: { include: { plugin: true } } } },
                  pluginToggles: { include: { plugin: true } },
                },
              },
            },
          },
        },
      });
    }
  }

  if (!user?.memberships.length) {
    return NextResponse.json({ error: "Nenhum tenant associado ao usuário" }, { status: 500 });
  }

  const preferredTenant =
    user.memberships.find((m) => m.tenantId === user.defaultTenantId) || user.memberships[0];

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: preferredTenant?.tenantId ?? null,
  });
  const res = NextResponse.json({ ok: true, tenantId: preferredTenant?.tenantId ?? null });
  res.cookies.set("token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
