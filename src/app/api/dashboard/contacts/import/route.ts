import { NextResponse } from "next/server";

import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { featureEnabled } from "@/lib/features";
import {
  ImportIssue,
  issueReportAsCsv,
  issueReportAsJson,
  validateCsvImport,
} from "@/lib/csv-import";

function respondError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireContactsAccess(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.tenant) return { auth: null, error: respondError("Acesso restrito ao tenant", 401) };
  if (!featureEnabled(auth, "contacts")) {
    return { auth: null, error: respondError("Contatos não habilitados para este tenant", 403) };
  }
  const membership = auth.user.memberships.find((m) => m.tenantId === auth.tenant?.id);
  if (!membership) return { auth: null, error: respondError("Usuário sem vínculo com o tenant", 403) };
  if (membership.role === "MEMBER") return { auth: null, error: respondError("Somente admins podem importar dados", 403) };
  return { auth, membership };
}

function presentIssue(issue: ImportIssue) {
  const { line, level, field, message, value } = issue;
  return { line, level, field, message, value };
}

function attachmentHeaders(filename: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename=\"${filename}\"`,
  } satisfies Record<string, string>;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { auth, error } = await requireContactsAccess(req);
  if (!auth) return error;
  if (!req.body) return respondError("Envie o CSV no corpo da requisição", 400);

  const url = new URL(req.url);
  const reportFormat = url.searchParams.get("report");
  const consentWarnings = url.searchParams.get("consentWarnings") === "true";

  const validation = await validateCsvImport(req.body);
  const { errorCount, warningCount } = validation;

  if (reportFormat === "csv" || reportFormat === "json") {
    const content =
      reportFormat === "csv"
        ? issueReportAsCsv(validation.issues)
        : issueReportAsJson(validation.issues);
    const headers =
      reportFormat === "csv"
        ? attachmentHeaders("relatorio-erros.csv", "text/csv")
        : attachmentHeaders("relatorio-erros.json", "application/json");
    return new NextResponse(content, { status: 200, headers });
  }

  const requiresWarningConsent = warningCount > 0;
  const canImport = errorCount === 0 && (consentWarnings || !requiresWarningConsent);

  return NextResponse.json({
    headers: validation.headers,
    preview: validation.preview,
    totals: {
      rows: validation.totalRows,
      validRows: validation.validRows,
      duplicates: {
        emails: validation.duplicateEmails,
        externalIds: validation.duplicateExternalIds,
      },
      errorCount,
      warningCount,
    },
    issues: validation.issues.slice(0, 100).map(presentIssue),
    canImport,
    requiresWarningConsent,
    blockingErrors: errorCount > 0,
    reportDownload: {
      csv: `${url.pathname}?report=csv`,
      json: `${url.pathname}?report=json`,
    },
  });
}
