import { NextResponse } from "next/server";

import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";

function forbidden(message: string, status = 403) {
  return NextResponse.json({ error: message }, { status });
}

async function requireSchedulingAccess(req: Request, requireManager = false) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.tenant) return { error: forbidden("Acesso restrito ao tenant"), auth: null, membership: null };
  if (!featureEnabled(auth, "scheduling")) {
    return { error: forbidden("Plugin de agendamento desabilitado"), auth: null, membership: null };
  }

  const membership = auth.user.memberships.find((m) => m.tenantId === auth.tenant?.id) ?? null;
  if (!membership) return { error: forbidden("Usuário sem vínculo com o tenant"), auth: null, membership: null };

  if (requireManager && membership.role === "MEMBER") {
    return { error: forbidden("Somente administradores podem alterar profissionais"), auth: null, membership: null };
  }

  return { auth, membership };
}

function present(professional: { id: string; name: string; title: string | null; createdAt: Date }) {
  return {
    id: professional.id,
    name: professional.name,
    title: professional.title,
    createdAt: professional.createdAt,
  };
}

export async function GET(req: Request) {
  const { auth, error } = await requireSchedulingAccess(req);
  if (!auth) return error;

  const professionals = await prisma.professional.findMany({
    where: { tenantId: auth.tenant!.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(professionals.map(present));
}

export async function POST(req: Request) {
  const { auth, error } = await requireSchedulingAccess(req, true);
  if (!auth) return error;

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const title = body?.title ? String(body.title).trim() : null;
  if (!name) return forbidden("Nome do profissional é obrigatório", 400);

  try {
    const record = await prisma.professional.create({
      data: { tenantId: auth.tenant!.id, name, title },
    });
    return NextResponse.json(present(record), { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return forbidden("Já existe um profissional com este nome neste tenant", 409);
    }
    console.error(err);
    return forbidden("Erro ao criar profissional", 500);
  }
}
