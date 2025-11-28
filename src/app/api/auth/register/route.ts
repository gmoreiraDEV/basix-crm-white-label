import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

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

export async function POST(req: Request) {
  const { email, password, name, tenantName } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });

  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "basic" } });
  if (!plan) return NextResponse.json({ error: "Plano padrão não encontrado" }, { status: 500 });

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName || `${name || email} Workspace`,
      slug: await uniqueTenantSlug(tenantName || name || email),
      subscriptionPlanId: plan.id,
    },
  });

  await provisionTenantPlugins(tenant.id, plan.id);

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hash,
      name,
      defaultTenantId: tenant.id,
      memberships: {
        create: {
          tenantId: tenant.id,
          role: "OWNER",
        },
      },
    },
  });
  return NextResponse.json({ ok: true, tenant: tenant.slug });
}
