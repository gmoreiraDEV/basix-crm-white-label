import { NextResponse } from "next/server";

import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";

function respondError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.user) return respondError("Usuário não autenticado", 401);

  const payload = await req.json();
  const source = String(payload?.source || "").trim();
  const fileName = String(payload?.fileName || "").trim();

  if (!source) return respondError("Origem do CRM é obrigatória", 400);
  if (!fileName) return respondError("Nome do arquivo é obrigatório", 400);

  const record = await prisma.importRequest.create({
    data: {
      source,
      fileName,
      userId: auth.user.id,
      tenantId: auth.tenant?.id ?? null,
    },
  });

  return NextResponse.json({
    id: record.id,
    fileName: record.fileName,
    source: record.source,
    createdAt: record.createdAt,
  });
}
