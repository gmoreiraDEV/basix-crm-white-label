import { NextResponse } from "next/server";

import { analyzeCsvImport, importSources, ImportSourceKey } from "@/lib/csv-import";
import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

function respondError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireCrmAdmin(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.tenant) {
    return { auth: null, error: respondError("Acesso restrito ao tenant", 401) } as const;
  }
  if (!featureEnabled(auth, "crm")) {
    return { auth: null, error: respondError("CRM não habilitado para este tenant", 403) } as const;
  }
  const membership = auth.user.memberships.find((m) => m.tenantId === auth.tenant?.id);
  if (!membership) return { auth: null, error: respondError("Usuário sem vínculo com o tenant", 403) } as const;
  if (membership.role === "MEMBER") {
    return { auth: null, error: respondError("Somente owner ou admin podem importar dados", 403) } as const;
  }
  return { auth, membership } as const;
}

function serializeJob(job: any) {
  return {
    id: job.id,
    source: job.source,
    fileName: job.fileName,
    status: job.status,
    totalRows: job.totalRows,
    validRows: job.validRows,
    invalidRows: job.invalidRows,
    message: job.message,
    createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
    preview: job.preview,
  };
}

export async function GET(req: Request) {
  const { auth, error } = await requireCrmAdmin(req);
  if (!auth) return error;

  const jobs = await prisma.importJob.findMany({
    where: { tenantId: auth.tenant!.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json(jobs.map(serializeJob));
}

export async function POST(req: Request) {
  const { auth, error } = await requireCrmAdmin(req);
  if (!auth) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return respondError("Não foi possível ler o formulário", 400);

  const file = formData.get("file");
  const source = (formData.get("source") as string | null)?.trim().toLowerCase() as ImportSourceKey | null;
  const delimiter = (formData.get("delimiter") as string | null)?.trim() || undefined;

  if (!(file instanceof File)) return respondError("Envie um arquivo CSV válido", 400);
  if (!file.size) return respondError("O arquivo está vazio", 400);
  if (file.size > MAX_FILE_SIZE) return respondError("O arquivo excede o limite de 8MB", 400);

  const sourceKey: ImportSourceKey = source && source in importSources ? source : "generic";

  const content = await file.text();
  const analysis = analyzeCsvImport(content, sourceKey, delimiter);

  if (!analysis.totalRows) {
    return respondError("Nenhuma linha encontrada no CSV", 400);
  }

  const job = await prisma.importJob.create({
    data: {
      tenantId: auth.tenant!.id,
      userId: auth.user.id,
      source: sourceKey,
      fileName: file.name,
      status: analysis.status,
      totalRows: analysis.totalRows,
      validRows: analysis.validRows,
      invalidRows: analysis.invalidRows,
      message:
        analysis.status === "FAILED"
          ? "Importação rejeitada pelas validações"
          : analysis.invalidRows
            ? "Importação validada com avisos"
            : "Importação validada",
      preview: {
        rows: analysis.preview,
        issues: analysis.issues.slice(0, 50),
      },
    },
  });

  return NextResponse.json({
    job: serializeJob(job),
    preview: analysis.preview,
    issues: analysis.issues.slice(0, 50),
  });
}
