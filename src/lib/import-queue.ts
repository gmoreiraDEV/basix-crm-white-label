import crypto from "crypto";
import { ImportJob } from "@prisma/client";
import { prisma } from "@/lib/db";

let workerStarted = false;
let isProcessing = false;

function deriveRows(csvData: string) {
  return csvData
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function calculateProgress(totalRows: number, processedRows: number) {
  if (!totalRows) return 0;
  return Math.min(100, Math.round((processedRows / totalRows) * 100));
}

async function processJob(job: ImportJob) {
  const rows = deriveRows(job.csvData);
  const totalRows = rows.length;

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", totalRows, processedRows: 0, errorMessage: null },
  });

  let processedRows = 0;
  try {
    for (const line of rows) {
      processedRows += 1;

      // Simulate row processing and an external ID check to keep idempotency
      const externalId = crypto.createHash("sha256").update(line).digest("hex");
      void externalId;

      if (processedRows % 10 === 0 || processedRows === totalRows) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: { processedRows },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", processedRows: totalRows },
    });
  } catch (error: any) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: error?.message || "Falha ao processar CSV.",
        processedRows,
      },
    });
  }
}

async function takeNextJob() {
  const pending = await prisma.importJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  return pending;
}

async function workerLoop() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const job = await takeNextJob();
    if (!job) return;
    await processJob(job);
  } finally {
    isProcessing = false;
  }
}

export function ensureImportWorker() {
  if (workerStarted) return;
  workerStarted = true;
  setInterval(() => {
    void workerLoop();
  }, 1000).unref();
}

export function getJobProgress(job: { totalRows: number; processedRows: number }) {
  return calculateProgress(job.totalRows, job.processedRows);
}

export function deriveDedupKey(
  userId: string,
  tenantId: string,
  filename: string,
  uploadedAt: string,
  csvData: string
) {
  const fingerprint = crypto
    .createHash("sha256")
    .update([userId, tenantId, filename, uploadedAt, csvData].join(":"))
    .digest("hex");
  return fingerprint;
}
