"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileDown, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CsvPreviewRow, csvTemplate, importSources, ImportSourceKey } from "@/lib/csv-import";

export type ImportJobDTO = {
  id: string;
  source: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  message?: string | null;
  createdAt: string;
};

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    VALIDATED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
  };
  const label: Record<string, string> = {
    VALIDATED: "Validado",
    PENDING: "Pendente",
    FAILED: "Rejeitado",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        palette[status] ?? palette.PENDING
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

function PreviewTable({ rows }: { rows: CsvPreviewRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-auto rounded-lg border bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Linha</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Nome</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">E-mail</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Telefone</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Empresa</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Observações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.index}>
              <td className="px-3 py-2 text-gray-600">{row.index + 2}</td>
              <td className="px-3 py-2 text-gray-900">{row.lead.name || "-"}</td>
              <td className="px-3 py-2 text-gray-900">{row.lead.email || "-"}</td>
              <td className="px-3 py-2 text-gray-900">{row.lead.phone || "-"}</td>
              <td className="px-3 py-2 text-gray-900">{row.lead.company || "-"}</td>
              <td className="px-3 py-2 text-gray-700">
                {row.issues.length ? (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    {row.issues.join("; ")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Pronto para importar
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportCsvPanel({ initialJobs }: { initialJobs: ImportJobDTO[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImportSourceKey>("hubspot");
  const [delimiter, setDelimiter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvPreviewRow[]>([]);
  const [issues, setIssues] = useState<CsvPreviewRow[]>([]);
  const [history, setHistory] = useState<ImportJobDTO[]>(initialJobs);

  const templateHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplate())}`, []);
  const previewIssues = useMemo(
    () => issues.filter((issue) => issue.index < preview.length),
    [issues, preview]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Selecione um CSV para continuar");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const body = new FormData();
    body.append("file", file);
    body.append("source", source);
    if (delimiter) body.append("delimiter", delimiter);

    const response = await fetch("/api/dashboard/imports/csv", { method: "POST", body });
    setSubmitting(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error || "Não foi possível validar o CSV");
      return;
    }

    const payload = await response.json();
    setPreview(payload.preview || []);
    setIssues(payload.issues || []);
    setHistory((current) => [payload.job, ...current].slice(0, 10));
    setMessage("Arquivo validado e pronto para processamento em background.");
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Importar contatos por CSV</h2>
            <p className="text-sm text-gray-600">
              Valide arquivos exportados de outros CRMs (HubSpot, Pipedrive, RD Station) e faça o merge com a base do
              tenant.
            </p>
          </div>
          <a
            href={templateHref}
            download="template-importacao.csv"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileDown className="h-4 w-4" /> Baixar template CSV
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-dashed bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-800">1. Selecione a origem</p>
            <p className="text-xs text-gray-600">Ajustamos o mapeamento automaticamente conforme o CRM exportado.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(importSources).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSource(key as ImportSourceKey)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${source === key ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-gray-200 bg-white text-gray-800"}`}
                >
                  <div className="font-semibold">{meta.label}</div>
                  <div className="text-xs text-gray-600">{meta.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-800">2. Valide o arquivo CSV</p>
            <p className="text-xs text-gray-600">
              Aceitamos arquivos UTF-8 até 8MB. O delimitador é detectado automaticamente, mas você pode informar abaixo.
            </p>
            <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
              <Input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Delimitador opcional
                  <Input
                    className="mt-1"
                    placeholder=", ou ;"
                    value={delimiter}
                    maxLength={1}
                    onChange={(event) => setDelimiter(event.target.value)}
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Controle de deduplicação
                  <Input
                    className="mt-1"
                    disabled
                    placeholder="E-mail e ID externo (padrão)"
                    title="Deduplicação por e-mail e ID externo já está habilitada automaticamente."
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={submitting}>
                  <UploadCloud className="mr-2 h-4 w-4" /> {submitting ? "Validando..." : "Validar CSV"}
                </Button>
                {error && <span className="text-sm text-red-700">{error}</span>}
                {message && <span className="text-sm text-emerald-700">{message}</span>}
              </div>
            </form>
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Pré-visualização das primeiras linhas</h3>
              <p className="text-sm text-gray-600">Revise os dados e corrija colunas marcadas com alerta.</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div>Linhas válidas: {preview.length - previewIssues.length}</div>
              <div>Linhas com aviso: {previewIssues.length}</div>
            </div>
          </div>
          <PreviewTable rows={preview} />
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Histórico recente</h3>
          <p className="text-sm text-gray-600">Somente owners e admins conseguem iniciar novas importações.</p>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma importação validada ainda.</p>
        ) : (
          <div className="overflow-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Arquivo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Origem</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Linhas</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Mensagem</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-2 font-medium text-gray-900">{job.fileName}</td>
                    <td className="px-3 py-2 text-gray-700">{importSources[job.source as ImportSourceKey]?.label ?? job.source}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {job.validRows} válidas / {job.invalidRows} com aviso ({job.totalRows} totais)
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <StatusPill status={job.status} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">{job.message || "-"}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {new Date(job.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
