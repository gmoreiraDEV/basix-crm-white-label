import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";

function respondError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.user) return respondError("Usuário não autenticado", 401);

  const formData = await req.formData();
  const source = String(formData.get("source") || "").trim();
  const file = formData.get("file");

  if (!source) return respondError("Origem do CRM é obrigatória", 400);
  if (!(file instanceof File)) return respondError("Arquivo CSV é obrigatório", 400);

  const fileName = String(file.name || "").trim();
  if (!fileName.toLowerCase().endsWith(".csv")) return respondError("Envie um arquivo .csv válido", 400);
  if (file.size > 5 * 1024 * 1024) return respondError("Limite de 5MB excedido", 400);

  const uploadDir = path.join(process.cwd(), "tmp", "importacoes");
  await fs.mkdir(uploadDir, { recursive: true });

  const storedName = `${Date.now()}-${randomUUID()}-${fileName}`;
  const storedPath = path.join(uploadDir, storedName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storedPath, fileBuffer);

  const record = await prisma.importRequest.create({
    data: {
      source,
      fileName,
      filePath: storedPath,
      fileSize: file.size,
      userId: auth.user.id,
      tenantId: auth.tenant?.id ?? null,
    },
  });

  return NextResponse.json({
    id: record.id,
    fileName: record.fileName,
    source: record.source,
    fileSize: record.fileSize,
    createdAt: record.createdAt,
  });
}
