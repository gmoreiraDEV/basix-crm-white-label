import { ImportJobStatus } from "@prisma/client";

export type ImportSourceKey = "generic" | "hubspot" | "pipedrive" | "rd-station";

export type NormalizedLead = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  externalId?: string;
  owner?: string;
  tags?: string[];
};

export type CsvPreviewRow = {
  index: number;
  lead: NormalizedLead;
  issues: string[];
};

export type CsvAnalysis = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: CsvPreviewRow[];
  issues: CsvPreviewRow[];
  status: ImportJobStatus;
};

export const importSources: Record<ImportSourceKey, { label: string; description: string }> = {
  generic: { label: "CSV genérico", description: "Planilha estruturada com colunas de contatos." },
  hubspot: { label: "HubSpot", description: "Exportação de contatos ou empresas do HubSpot." },
  pipedrive: { label: "Pipedrive", description: "Exportação de pessoas e organizações do Pipedrive." },
  "rd-station": { label: "RD Station", description: "Leads exportados do RD Station Marketing." },
};

const baseMapping: Record<string, keyof NormalizedLead> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  "first name": "name",
  firstname: "name",
  "last name": "name",
  lastname: "name",
  email: "email",
  mail: "email",
  telefone: "phone",
  phone: "phone",
  mobile: "phone",
  celular: "phone",
  company: "company",
  empresa: "company",
  organization: "company",
  organisation: "company",
  owner: "owner",
  "crm owner": "owner",
  tags: "tags",
  label: "tags",
  labels: "tags",
  "external id": "externalId",
  id: "externalId",
  "record id": "externalId",
};

const sourceSpecificMapping: Record<ImportSourceKey, Record<string, keyof NormalizedLead>> = {
  generic: {},
  hubspot: {
    "hs_object_id": "externalId",
    "hubspot owner": "owner",
    "deal owner": "owner",
    "associated company": "company",
  },
  pipedrive: {
    "organization name": "company",
    "org name": "company",
    "person name": "name",
    "person phone": "phone",
    "person email": "email",
    "owner name": "owner",
    "owner email": "owner",
  },
  "rd-station": {
    lead: "name",
    "lead id": "externalId",
    "client id": "externalId",
    origem: "owner",
  },
};

function normalizeHeader(value: string) {
  return value.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toLowerCase();
}

function detectDelimiter(content: string) {
  const sample = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ",";
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsv(content: string, delimiter?: string) {
  const sanitized = content.replace(/^\uFEFF/, "");
  const detectedDelimiter = delimiter && delimiter.length === 1 ? delimiter : detectDelimiter(sanitized);
  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { headers: [] as string[], rows: [] as Record<string, string>[] };
  }

  const headers = parseLine(lines[0], detectedDelimiter);
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line, detectedDelimiter);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });

  return { headers, rows };
}

function mapField(header: string, source: ImportSourceKey) {
  const normalized = normalizeHeader(header);
  const sourceMapping = sourceSpecificMapping[source];
  return sourceMapping[normalized] ?? baseMapping[normalized] ?? null;
}

function validateLead(lead: NormalizedLead) {
  const issues: string[] = [];
  if (!lead.name && !lead.email && !lead.phone) {
    issues.push("Inclua ao menos nome, e-mail ou telefone.");
  }
  if (lead.email && !/^\S+@\S+\.\S+$/.test(lead.email)) {
    issues.push("E-mail com formato inválido.");
  }
  const digits = lead.phone?.replace(/\D/g, "") ?? "";
  if (lead.phone && digits.length < 8) {
    issues.push("Telefone muito curto para validar.");
  }
  return issues;
}

export function normalizeRows(
  rows: Record<string, string>[],
  source: ImportSourceKey
): { normalized: NormalizedLead[]; issues: CsvPreviewRow[] } {
  const normalized: NormalizedLead[] = [];
  const issues: CsvPreviewRow[] = [];

  rows.forEach((row, index) => {
    const nameParts: string[] = [];
    const result: NormalizedLead = {};

    Object.entries(row).forEach(([header, rawValue]) => {
      const value = String(rawValue ?? "").trim();
      if (!value) return;
      const field = mapField(header, source);
      if (!field) return;
      if (field === "name" && /last\s?name|sobrenome/i.test(header)) {
        nameParts.push(value);
        return;
      }
      if (field === "name" && /first\s?name|nome/i.test(header)) {
        nameParts.unshift(value);
        return;
      }
      if (field === "tags") {
        result.tags = [...(result.tags ?? []), ...value.split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean)];
        return;
      }
      result[field] = value;
    });

    if (!result.name && nameParts.length) {
      result.name = nameParts.join(" ").trim();
    }

    const rowIssues = validateLead(result);
    if (rowIssues.length) {
      issues.push({ index, lead: result, issues: rowIssues });
    }
    normalized.push(result);
  });

  return { normalized, issues };
}

export function analyzeCsvImport(content: string, source: ImportSourceKey, delimiter?: string): CsvAnalysis {
  const parsed = parseCsv(content, delimiter);
  const { normalized, issues } = normalizeRows(parsed.rows, source);
  const preview = normalized.slice(0, 20).map((lead, index) => ({
    index,
    lead,
    issues: issues.find((issue) => issue.index === index)?.issues ?? [],
  }));

  const validRows = normalized.length - issues.length;
  const status = issues.length === normalized.length ? ImportJobStatus.FAILED : ImportJobStatus.VALIDATED;

  return {
    totalRows: normalized.length,
    validRows,
    invalidRows: issues.length,
    preview,
    issues,
    status,
  };
}

export function csvTemplate() {
  return [
    "name,email,phone,company,externalId,tags",
    "Maria Silva,maria@example.com,11999999999,Exemplo SA,hub-123,cliente;vip",
    "João Lima,joao@example.com,21988888888,Lima Tech,pipedrive-456,lead quente",
  ].join("\n");
}
