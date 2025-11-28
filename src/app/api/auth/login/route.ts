import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
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
