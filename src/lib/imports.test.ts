import { describe, expect, it } from "vitest";

import {
  calculateMetrics,
  ImportService,
  InMemoryImportRepository,
  mapRowToContact,
  normalizeRow,
  validateRow,
} from "./imports";

describe("normalizeRow", () => {
  it("normalizes aliases and trims values", () => {
    const input = { "Nome Completo": "  Ana  ", "e-mail": "TEST@MAIL.COM", phone_number: " (11) 9999-0000 " };
    const result = normalizeRow(input);

    expect(result).toEqual({ name: "Ana", email: "TEST@MAIL.COM", phone: "(11) 9999-0000" });
  });
});

describe("validateRow", () => {
  it("flags missing or invalid fields", () => {
    const result = validateRow({ name: "A", email: "invalid", phone: "123" });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["Nome obrigatório", "E-mail inválido", "Telefone muito curto"]);
  });

  it("accepts well formed rows", () => {
    const result = validateRow({ name: "Ana", email: "ana@example.com", phone: "(11) 9999-0000" });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("mapRowToContact", () => {
  it("maps normalized data into a contact payload", () => {
    const mapped = mapRowToContact({ name: "Bruno", email: "bruno@teste.com", phone: "(11) 88888-7777", crmId: "123" });
    expect(mapped).toEqual({
      fullName: "Bruno",
      email: "bruno@teste.com",
      phone: "11888887777",
      crmId: "123",
      isUpdate: true,
    });
  });
});

describe("calculateMetrics", () => {
  it("computes duration, error rate and throughput", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date(start.getTime() + 30_000);
    const metrics = calculateMetrics(10, 8, 2, start, end);

    expect(metrics.durationMs).toBe(30000);
    expect(metrics.errorRate).toBe(0.2);
    expect(metrics.linesPerMinute).toBeCloseTo((8 / 30_000) * 60000);
  });
});

describe("ImportService", () => {
  it("runs an end-to-end import job and stores audit data", async () => {
    const repository = new InMemoryImportRepository();
    const service = new ImportService(repository);
    const rows = [
      { Nome: "Ana", Email: "ana@crm.com", Phone: "(11) 9999-0000" },
      { Nome: "Bruno", Email: "invalid", Phone: "123" },
      { full_name: "Ana Paula", email: "ana@crm.com", crm_id: "crm-01" },
    ];

    const response = await service.ingestUpload({
      tenantId: "tenant-1",
      userId: "user-1",
      sourceCrm: "hubspot",
      fileName: "contacts.csv",
      rows,
    });

    expect(response.job.status).toBe("COMPLETED");
    expect(response.job.totalRows).toBe(3);
    expect(response.job.createdCount).toBe(1);
    expect(response.job.updatedCount).toBe(1);
    expect(response.job.ignoredCount).toBe(1);
    expect(response.job.errorCount).toBe(1);
    expect(response.job.linesPerMinute).toBeGreaterThan(0);
    expect(response.job.auditSummary).toContain("hubspot");

    const structuredLog = response.logs.find((log) => log.message === "row.validation_failed");
    expect(structuredLog?.context).toMatchObject({ rowNumber: 2 });
    expect(structuredLog?.jobId).toBe(response.job.id);
    expect(structuredLog?.userId).toBe("user-1");
  });
});
