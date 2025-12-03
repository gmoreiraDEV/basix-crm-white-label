import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { AVAILABLE_API_SCOPES, buildApiKeySecret, presentApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";

function respondError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function allowedScopes(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return input.filter((scope) => scope && AVAILABLE_API_SCOPES[scope as keyof typeof AVAILABLE_API_SCOPES]);
}

async function requireSettingsAccess(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.tenant) return { auth: null, error: respondError("Acesso restrito ao tenant", 401) };
  if (!featureEnabled(auth, "settings")) {
    return { auth: null, error: respondError("Ajustes não habilitados para este tenant", 403) };
  }
  const membership = auth.user.memberships.find((m) => m.tenantId === auth.tenant?.id);
  if (!membership) return { auth: null, error: respondError("Usuário sem vínculo com o tenant", 403) };
  if (membership.role === "MEMBER") return { auth: null, error: respondError("Somente admins podem gerenciar chaves", 403) };
  return { auth, membership };
}

export async function GET(req: Request) {
  const { auth, error } = await requireSettingsAccess(req);
  if (!auth) return error;

  const keys = await prisma.tenantApiKey.findMany({
    where: { tenantId: auth.tenant!.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(keys.map(presentApiKey));
}

export async function POST(req: Request) {
  const { auth, error } = await requireSettingsAccess(req);
  if (!auth) return error;

  const payload = await req.json();
  const name = String(payload?.name || "").trim();
  const scopes = allowedScopes(payload?.scopes);

  if (!name) return respondError("Nome da chave é obrigatório", 400);
  if (!scopes.length) return respondError("Selecione ao menos um escopo", 400);

  const id = crypto.randomUUID();
  const secret = buildApiKeySecret(id);
  const keyHash = await bcrypt.hash(secret, 10);

  const record = await prisma.tenantApiKey.create({
    data: {
      id,
      tenantId: auth.tenant!.id,
      name,
      scopes,
      keyHash,
      preview: secret.slice(-6),
    },
  });

  return NextResponse.json({ apiKey: presentApiKey(record), secret }, { status: 201 });
}

export async function PATCH(req: Request) {
  const { auth, error } = await requireSettingsAccess(req);
  if (!auth) return error;

  const { id, revoked } = await req.json();
  if (!id || typeof revoked !== "boolean") {
    return respondError("Dados inválidos", 400);
  }

  const existing = await prisma.tenantApiKey.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== auth.tenant!.id) {
    return respondError("Chave não encontrada", 404);
  }

  const updated = await prisma.tenantApiKey.update({
    where: { id },
    data: { revoked, revokedAt: revoked ? new Date() : null },
  });

  return NextResponse.json(presentApiKey(updated));
}
