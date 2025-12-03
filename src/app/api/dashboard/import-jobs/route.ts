import { NextResponse } from "next/server";
import { ImportJobStatus } from "@prisma/client";
import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { deriveDedupKey, ensureImportWorker, getJobProgress } from "@/lib/import-queue";
import { ImportJobDto } from "@/types/import-jobs";

function serializeJob(job: any): ImportJobDto & { progress: number } {
  return {
    id: job.id,
    status: job.status as ImportJobStatus,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    errorMessage: job.errorMessage,
    dedupKey: job.dedupKey,
    filename: job.filename,
    createdAt: job.createdAt.toISOString(),
    progress: getJobProgress(job),
  };
}

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const auth = await buildAuthContext(token);

  if (!auth?.tenant) {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const file = formData.get("file");
  const uploadedAt = (formData.get("uploadedAt") || formData.get("timestamp") || new Date().toISOString()).toString();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo CSV" }, { status: 400 });
  }

  const filename = file.name || "upload.csv";
  const buffer = Buffer.from(await file.arrayBuffer());
  const csvData = buffer.toString("utf-8").trim();

  const dedupKey = deriveDedupKey(auth.user.id, auth.tenant.id, filename, uploadedAt, csvData);
  const existing = await prisma.importJob.findUnique({ where: { dedupKey } });
  if (existing) {
    const job = serializeJob(existing);
    return NextResponse.json({ job, deduped: true });
  }

  const totalRows = csvData ? csvData.split(/\r?\n/).filter((line) => line.trim()).length : 0;

  const job = await prisma.importJob.create({
    data: {
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      filename,
      dedupKey,
      csvData,
      uploadedAt: new Date(uploadedAt),
      status: "PENDING",
      totalRows,
      processedRows: 0,
    },
  });

  ensureImportWorker();

  return NextResponse.json({ job: serializeJob(job), deduped: false });
}

export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  const auth = await buildAuthContext(token);

  if (!auth?.tenant) {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 });
  }

  const jobs = await prisma.importJob.findMany({
    where: { tenantId: auth.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs: jobs.map(serializeJob) });
}
