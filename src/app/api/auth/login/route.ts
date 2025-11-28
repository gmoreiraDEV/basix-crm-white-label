import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

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

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });

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
