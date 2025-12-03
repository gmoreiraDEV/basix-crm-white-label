import { Readable } from "node:stream";

export type ImportIssueLevel = "error" | "warning";

export type ImportIssue = {
  line: number;
  level: ImportIssueLevel;
  message: string;
  field?: string;
  value?: string | null;
};

export type ImportPreviewRow = {
  line: number;
  values: Record<string, string>;
  issues: ImportIssue[];
};

export type ImportValidationResult = {
  headers: string[];
  preview: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  duplicateEmails: number;
  duplicateExternalIds: number;
  issues: ImportIssue[];
};

type ValidationConfig = {
  requiredFields: string[];
  emailField: string;
  phoneField: string;
  externalIdField: string;
  dateFields: string[];
  maxPreviewRows: number;
};

const defaultConfig: ValidationConfig = {
  requiredFields: ["name", "email", "externalId"],
  emailField: "email",
  phoneField: "phone",
  externalIdField: "externalId",
  dateFields: ["birthDate"],
  maxPreviewRows: 20,
};

export async function validateCsvImport(
  body: ReadableStream<Uint8Array>,
  config: Partial<ValidationConfig> = {}
): Promise<ImportValidationResult> {
  const merged = { ...defaultConfig, ...config } satisfies ValidationConfig;

  const decoder = new TextDecoder();
  const preview: ImportPreviewRow[] = [];
  const issues: ImportIssue[] = [];
  const seenEmails = new Set<string>();
  const seenExternalIds = new Set<string>();

  let buffer = "";
  let headers: string[] | null = null;
  let lineNumber = 0;
  let totalRows = 0;
  let validRows = 0;
  let duplicateEmails = 0;
  let duplicateExternalIds = 0;

  const stream = Readable.fromWeb(body as any);

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk as Buffer, { stream: true });
    let newlineIndex: number;

    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const rawLine = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      lineNumber += 1;

      if (headers === null) {
        headers = parseCsvLine(rawLine);
        registerMissingHeaders(headers, merged.requiredFields, lineNumber, issues);
        continue;
      }

      if (!rawLine.trim()) continue;

      const columns = parseCsvLine(rawLine);
      const row = mapRow(headers, columns);
      totalRows += 1;
      const rowIssues: ImportIssue[] = [];

      runRequiredValidation(row, merged.requiredFields, lineNumber, rowIssues);
      runEmailValidation(row, merged.emailField, lineNumber, rowIssues, seenEmails, () => {
        duplicateEmails += 1;
      });
      runPhoneValidation(row, merged.phoneField, lineNumber, rowIssues);
      runDateValidation(row, merged.dateFields, lineNumber, rowIssues);
      runExternalIdValidation(
        row,
        merged.externalIdField,
        lineNumber,
        rowIssues,
        seenExternalIds,
        () => {
          duplicateExternalIds += 1;
        }
      );

      const hasCritical = rowIssues.some((issue) => issue.level === "error");
      if (!hasCritical) validRows += 1;

      if (preview.length < merged.maxPreviewRows) {
        preview.push({ line: lineNumber, values: row, issues: rowIssues });
      }

      issues.push(...rowIssues);
    }
  }

  buffer += decoder.decode();

  if (buffer.length) {
    lineNumber += 1;
    if (headers === null) {
      headers = parseCsvLine(buffer);
      registerMissingHeaders(headers, merged.requiredFields, lineNumber, issues);
    } else {
      const columns = parseCsvLine(buffer.replace(/\r$/, ""));
      const row = mapRow(headers, columns);
      totalRows += 1;
      const rowIssues: ImportIssue[] = [];

      runRequiredValidation(row, merged.requiredFields, lineNumber, rowIssues);
      runEmailValidation(row, merged.emailField, lineNumber, rowIssues, seenEmails, () => {
        duplicateEmails += 1;
      });
      runPhoneValidation(row, merged.phoneField, lineNumber, rowIssues);
      runDateValidation(row, merged.dateFields, lineNumber, rowIssues);
      runExternalIdValidation(
        row,
        merged.externalIdField,
        lineNumber,
        rowIssues,
        seenExternalIds,
        () => {
          duplicateExternalIds += 1;
        }
      );

      const hasCritical = rowIssues.some((issue) => issue.level === "error");
      if (!hasCritical) validRows += 1;

      if (preview.length < merged.maxPreviewRows) {
        preview.push({ line: lineNumber, values: row, issues: rowIssues });
      }

      issues.push(...rowIssues);
    }
  }

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const warningCount = issues.filter((issue) => issue.level === "warning").length;

  return {
    headers: headers ?? [],
    preview,
    totalRows,
    validRows,
    errorCount,
    warningCount,
    duplicateEmails,
    duplicateExternalIds,
    issues,
  };
}

export function issueReportAsCsv(issues: ImportIssue[]) {
  const header = "line,level,field,message,value";
  const rows = issues.map((issue) =>
    [
      issue.line,
      issue.level,
      issue.field ?? "",
      escapeCsvValue(issue.message),
      escapeCsvValue(issue.value ?? ""),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function issueReportAsJson(issues: ImportIssue[]) {
  return JSON.stringify({ issues }, null, 2);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function mapRow(headers: string[], values: string[]) {
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    row[header] = values[index] ?? "";
  });
  return row;
}

function registerMissingHeaders(
  headers: string[],
  requiredFields: string[],
  lineNumber: number,
  issues: ImportIssue[]
) {
  requiredFields
    .filter((field) => !headers.includes(field))
    .forEach((field) =>
      issues.push({
        line: lineNumber,
        field,
        level: "error",
        message: `Cabeçalho obrigatório ausente: ${field}`,
      })
    );
}

function runRequiredValidation(
  row: Record<string, string>,
  requiredFields: string[],
  lineNumber: number,
  issues: ImportIssue[]
) {
  requiredFields.forEach((field) => {
    const value = (row[field] ?? "").trim();
    if (!value) {
      issues.push({
        line: lineNumber,
        field,
        level: "error",
        message: `Campo obrigatório ausente: ${field}`,
        value,
      });
    }
  });
}

function runEmailValidation(
  row: Record<string, string>,
  field: string,
  lineNumber: number,
  issues: ImportIssue[],
  seenEmails: Set<string>,
  onDuplicate: () => void
) {
  const rawValue = (row[field] ?? "").trim();
  if (!rawValue) return;

  const normalized = rawValue.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue)) {
    issues.push({
      line: lineNumber,
      field,
      level: "error",
      message: "Formato de e-mail inválido",
      value: rawValue,
    });
    return;
  }

  if (seenEmails.has(normalized)) {
    onDuplicate();
    issues.push({
      line: lineNumber,
      field,
      level: "error",
      message: "E-mail duplicado no arquivo",
      value: rawValue,
    });
  } else {
    seenEmails.add(normalized);
  }
}

function runPhoneValidation(
  row: Record<string, string>,
  field: string,
  lineNumber: number,
  issues: ImportIssue[]
) {
  const rawValue = (row[field] ?? "").trim();
  if (!rawValue) return;

  const digits = rawValue.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    issues.push({
      line: lineNumber,
      field,
      level: "warning",
      message: "Telefone com quantidade de dígitos inesperada",
      value: rawValue,
    });
  }
}

function runDateValidation(
  row: Record<string, string>,
  fields: string[],
  lineNumber: number,
  issues: ImportIssue[]
) {
  fields.forEach((field) => {
    const rawValue = (row[field] ?? "").trim();
    if (!rawValue) return;

    if (!isValidDate(rawValue)) {
      issues.push({
        line: lineNumber,
        field,
        level: "error",
        message: "Formato de data inválido (use AAAA-MM-DD ou DD/MM/AAAA)",
        value: rawValue,
      });
    }
  });
}

function runExternalIdValidation(
  row: Record<string, string>,
  field: string,
  lineNumber: number,
  issues: ImportIssue[],
  seenExternalIds: Set<string>,
  onDuplicate: () => void
) {
  const rawValue = (row[field] ?? "").trim();
  if (!rawValue) {
    issues.push({
      line: lineNumber,
      field,
      level: "error",
      message: `Campo obrigatório ausente: ${field}`,
      value: rawValue,
    });
    return;
  }

  if (seenExternalIds.has(rawValue)) {
    onDuplicate();
    issues.push({
      line: lineNumber,
      field,
      level: "error",
      message: "ID externo duplicado no arquivo",
      value: rawValue,
    });
  } else {
    seenExternalIds.add(rawValue);
  }
}

function isValidDate(value: string) {
  const isoLike = /^\d{4}-\d{2}-\d{2}$/;
  const ptLike = /^\d{2}\/\d{2}\/\d{4}$/;

  if (isoLike.test(value)) {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }

  if (ptLike.test(value)) {
    const [day, month, year] = value.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  return false;
}

function escapeCsvValue(value: string) {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
