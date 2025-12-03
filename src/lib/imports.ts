import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";

export type ImportStatus = "PENDING" | "COMPLETED" | "FAILED";

export type ImportRow = Record<string, string | number | null | undefined>;

export interface ImportJobRecord {
  id: string;
  tenantId: string;
  userId: string;
  sourceCrm: string;
  fileName?: string;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  ignoredCount: number;
  errorCount: number;
  durationMs?: number;
  errorRate?: number;
  linesPerMinute?: number;
  startedAt: Date;
  completedAt?: Date;
  auditSummary?: string;
}

export interface ImportLogRecord {
  id: string;
  jobId: string;
  userId: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateJobInput {
  tenantId: string;
  userId: string;
  sourceCrm: string;
  fileName?: string;
  totalRows: number;
  startedAt: Date;
}

export interface FinalizeJobInput {
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  ignoredCount: number;
  errorCount: number;
  durationMs: number;
  errorRate: number;
  linesPerMinute: number;
  completedAt: Date;
  auditSummary: string;
  status: ImportStatus;
}

export interface ImportRepository {
  createJob(input: CreateJobInput): Promise<ImportJobRecord>;
  appendLog(entry: Omit<ImportLogRecord, "id" | "createdAt">): Promise<ImportLogRecord>;
  finalizeJob(jobId: string, input: FinalizeJobInput): Promise<ImportJobRecord>;
  listLogs(jobId: string): Promise<ImportLogRecord[]>;
}

export class PrismaImportRepository implements ImportRepository {
  async createJob(input: CreateJobInput): Promise<ImportJobRecord> {
    const record = await prisma.importJob.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        sourceCrm: input.sourceCrm,
        fileName: input.fileName,
        totalRows: input.totalRows,
        startedAt: input.startedAt,
      },
    });

    return record;
  }

  async appendLog(entry: Omit<ImportLogRecord, "id" | "createdAt">): Promise<ImportLogRecord> {
    const record = await prisma.importLog.create({
      data: {
        jobId: entry.jobId,
        userId: entry.userId,
        level: entry.level,
        message: entry.message,
        context: entry.context,
      },
    });

    return record;
  }

  async finalizeJob(jobId: string, input: FinalizeJobInput): Promise<ImportJobRecord> {
    const record = await prisma.importJob.update({
      where: { id: jobId },
      data: {
        processedRows: input.processedRows,
        createdCount: input.createdCount,
        updatedCount: input.updatedCount,
        ignoredCount: input.ignoredCount,
        errorCount: input.errorCount,
        durationMs: input.durationMs,
        errorRate: input.errorRate,
        linesPerMinute: input.linesPerMinute,
        completedAt: input.completedAt,
        auditSummary: input.auditSummary,
        status: input.status,
      },
    });

    return record;
  }

  async listLogs(jobId: string): Promise<ImportLogRecord[]> {
    return prisma.importLog.findMany({ where: { jobId }, orderBy: { createdAt: "asc" } });
  }
}

export class InMemoryImportRepository implements ImportRepository {
  public jobs: ImportJobRecord[] = [];
  public logs: ImportLogRecord[] = [];

  async createJob(input: CreateJobInput): Promise<ImportJobRecord> {
    const job: ImportJobRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      sourceCrm: input.sourceCrm,
      fileName: input.fileName,
      status: "PENDING",
      totalRows: input.totalRows,
      processedRows: 0,
      createdCount: 0,
      updatedCount: 0,
      ignoredCount: 0,
      errorCount: 0,
      durationMs: undefined,
      errorRate: undefined,
      linesPerMinute: undefined,
      startedAt: input.startedAt,
      completedAt: undefined,
      auditSummary: undefined,
    };

    this.jobs.push(job);
    return job;
  }

  async appendLog(entry: Omit<ImportLogRecord, "id" | "createdAt">): Promise<ImportLogRecord> {
    const log: ImportLogRecord = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date(),
    };

    this.logs.push(log);
    return log;
  }

  async finalizeJob(jobId: string, input: FinalizeJobInput): Promise<ImportJobRecord> {
    const jobIndex = this.jobs.findIndex((job) => job.id === jobId);
    if (jobIndex === -1) {
      throw new Error(`Job ${jobId} not found`);
    }

    const updated: ImportJobRecord = {
      ...this.jobs[jobIndex],
      processedRows: input.processedRows,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      ignoredCount: input.ignoredCount,
      errorCount: input.errorCount,
      durationMs: input.durationMs,
      errorRate: input.errorRate,
      linesPerMinute: input.linesPerMinute,
      completedAt: input.completedAt,
      auditSummary: input.auditSummary,
      status: input.status,
    };

    this.jobs[jobIndex] = updated;
    return updated;
  }

  async listLogs(jobId: string): Promise<ImportLogRecord[]> {
    return this.logs.filter((log) => log.jobId === jobId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const keyMap: Record<string, string> = {
  nome: "name",
  "nome completo": "name",
  full_name: "name",
  name: "name",
  email: "email",
  "e-mail": "email",
  mail: "email",
  telefone: "phone",
  phone: "phone",
  phone_number: "phone",
  crm: "crmId",
  crmid: "crmId",
  crm_id: "crmId",
};

const sanitizeKey = (key: string) => key.trim().toLowerCase();

export function normalizeRow(input: ImportRow): ImportRow {
  const normalized: ImportRow = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = sanitizeKey(rawKey);
    const mappedKey = keyMap[key] ?? key;
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    normalized[mappedKey] = value;
  }
  return normalized;
}

export function validateRow(row: ImportRow): ValidationResult {
  const errors: string[] = [];
  const name = row.name as string | undefined;
  const email = row.email as string | undefined;

  if (!name || name.length < 2) {
    errors.push("Nome obrigatório");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("E-mail inválido");
  }

  const phone = row.phone as string | undefined;
  if (phone && phone.replace(/\D/g, "").length < 8) {
    errors.push("Telefone muito curto");
  }

  return { valid: errors.length === 0, errors };
}

export interface MappedContact {
  fullName: string;
  email: string;
  phone?: string;
  crmId?: string;
  isUpdate: boolean;
}

export function mapRowToContact(row: ImportRow): MappedContact {
  const phone = row.phone ? String(row.phone).replace(/\D/g, "") : undefined;
  const crmId = row.crmId ? String(row.crmId) : undefined;

  return {
    fullName: String(row.name ?? "").trim(),
    email: String(row.email ?? "").toLowerCase(),
    phone,
    crmId,
    isUpdate: Boolean(crmId),
  };
}

export interface Metrics {
  durationMs: number;
  errorRate: number;
  linesPerMinute: number;
}

export function calculateMetrics(totalRows: number, processedRows: number, errorCount: number, startedAt: Date, completedAt: Date): Metrics {
  const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());
  const errorRate = totalRows === 0 ? 0 : errorCount / totalRows;
  const linesPerMinute = (processedRows / durationMs) * 60000;
  return { durationMs, errorRate, linesPerMinute };
}

export interface ImportRequest {
  tenantId: string;
  userId: string;
  sourceCrm: string;
  fileName?: string;
  rows: ImportRow[];
}

export interface ImportResponse {
  job: ImportJobRecord;
  logs: ImportLogRecord[];
}

export class ImportService {
  constructor(private readonly repository: ImportRepository) {}

  async ingestUpload(request: ImportRequest): Promise<ImportResponse> {
    const startedAt = new Date();
    const job = await this.repository.createJob({
      tenantId: request.tenantId,
      userId: request.userId,
      sourceCrm: request.sourceCrm,
      fileName: request.fileName,
      totalRows: request.rows.length,
      startedAt,
    });

    await this.repository.appendLog({
      jobId: job.id,
      userId: request.userId,
      level: "info",
      message: "job.started",
      context: { tenantId: request.tenantId, sourceCrm: request.sourceCrm, fileName: request.fileName, totalRows: request.rows.length },
    });

    let processedRows = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;
    let errorCount = 0;

    for (const [index, rawRow] of request.rows.entries()) {
      const normalized = normalizeRow(rawRow);
      const validation = validateRow(normalized);
      const rowContext = { rowNumber: index + 1, normalized };

      await this.repository.appendLog({
        jobId: job.id,
        userId: request.userId,
        level: "debug",
        message: "row.normalized",
        context: rowContext,
      });

      if (!validation.valid) {
        errorCount += 1;
        ignoredCount += 1;
        await this.repository.appendLog({
          jobId: job.id,
          userId: request.userId,
          level: "warn",
          message: "row.validation_failed",
          context: { ...rowContext, errors: validation.errors },
        });
        continue;
      }

      const contact = mapRowToContact(normalized);
      processedRows += 1;
      if (contact.isUpdate) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }

      await this.repository.appendLog({
        jobId: job.id,
        userId: request.userId,
        level: "info",
        message: "row.processed",
        context: { ...rowContext, contact },
      });
    }

    const completedAt = new Date();
    const metrics = calculateMetrics(job.totalRows, processedRows, errorCount, startedAt, completedAt);
    const auditSummary = `Importado por ${request.userId} a partir de ${request.sourceCrm}: ${createdCount} criados, ${updatedCount} atualizados, ${ignoredCount} ignorados.`;

    const finalized = await this.repository.finalizeJob(job.id, {
      processedRows,
      createdCount,
      updatedCount,
      ignoredCount,
      errorCount,
      durationMs: metrics.durationMs,
      errorRate: metrics.errorRate,
      linesPerMinute: metrics.linesPerMinute,
      completedAt,
      auditSummary,
      status: "COMPLETED",
    });

    await this.repository.appendLog({
      jobId: job.id,
      userId: request.userId,
      level: "info",
      message: "job.completed",
      context: {
        processedRows,
        createdCount,
        updatedCount,
        ignoredCount,
        errorCount,
        metrics,
        auditSummary,
      },
    });

    const logs = await this.repository.listLogs(job.id);
    return { job: finalized, logs };
  }
}
