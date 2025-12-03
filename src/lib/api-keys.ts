import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TenantApiKey } from "@prisma/client";

import { prisma } from "@/lib/db";

export const API_KEY_PREFIX = "bak";

export const AVAILABLE_API_SCOPES = {
  "scheduling:professionals:read": "Listar profissionais habilitados para agendamento.",
  "scheduling:appointments:write": "Criar novos horários e reuniões para um profissional.",
  "scheduling:appointments:read": "Consultar compromissos agendados deste tenant.",
} as const;

export type ApiScope = keyof typeof AVAILABLE_API_SCOPES;

export function buildApiKeySecret(id: string) {
  return `${API_KEY_PREFIX}_${id}_${crypto.randomBytes(12).toString("hex")}`;
}

export function readApiKeyFromRequest(req: Request) {
  const header = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  return header?.trim() || null;
}

export function parseApiKey(secret: string | null) {
  if (!secret) return null;
  const parts = secret.split("_");
  if (parts.length < 3) return null;
  const [prefix, id] = parts;
  if (prefix !== API_KEY_PREFIX || !id) return null;
  return { id };
}

export async function verifyApiKey(secret: string): Promise<TenantApiKey | null> {
  const parsed = parseApiKey(secret);
  if (!parsed) return null;

  const record = await prisma.tenantApiKey.findUnique({ where: { id: parsed.id } });
  if (!record || record.revoked) return null;

  const valid = await bcrypt.compare(secret, record.keyHash);
  if (!valid) return null;

  return record;
}

export async function authenticateApiKeyRequest(
  req: Request,
  requiredScopes: ApiScope[] = []
): Promise<{ apiKey: TenantApiKey } | { status: number; message: string }> {
  const rawKey = readApiKeyFromRequest(req);
  if (!rawKey) {
    return { status: 401, message: "API key ausente" };
  }

  const apiKey = await verifyApiKey(rawKey);
  if (!apiKey) {
    return { status: 401, message: "API key inválida ou revogada" };
  }

  const missingScope = requiredScopes.find((scope) => !apiKey.scopes.includes(scope));
  if (missingScope) {
    return { status: 403, message: `Escopo obrigatório ausente: ${missingScope}` };
  }

  return { apiKey };
}

export function presentApiKey(apiKey: TenantApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    scopes: apiKey.scopes,
    preview: apiKey.preview,
    revoked: apiKey.revoked,
    revokedAt: apiKey.revokedAt,
    createdAt: apiKey.createdAt,
  };
}
