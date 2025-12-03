import { NextResponse } from "next/server";
import { ImportJobStatus } from "@prisma/client";
import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { getJobProgress } from "@/lib/import-queue";
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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = getTokenFromRequest(req);
  const auth = await buildAuthContext(token);

  if (!auth?.tenant) {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 });
  }

  const job = await prisma.importJob.findUnique({ where: { id: params.id } });
  if (!job || job.tenantId !== auth.tenant.id) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ job: serializeJob(job) });
}
