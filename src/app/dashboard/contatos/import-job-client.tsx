"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImportJobDto, ImportJobStatus } from "@/types/import-jobs";

const POLL_INTERVAL = 2000;

type Toast = { id: string; message: string; variant: "success" | "error" | "info" };

function jobProgress(job: Pick<ImportJobDto, "processedRows" | "totalRows">) {
  if (!job.totalRows) return 0;
  return Math.min(100, Math.round((job.processedRows / job.totalRows) * 100));
}

function formatStatus(status?: ImportJobStatus) {
  switch (status) {
    case "COMPLETED":
      return "Concluído";
    case "PROCESSING":
      return "Processando";
    case "FAILED":
      return "Falhou";
    default:
      return "Pendente";
  }
}

export function ImportJobClient() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportJobDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatus = useRef<ImportJobStatus | null>(null);

  const progress = useMemo(() => (job ? jobProgress(job) : 0), [job]);

  function pushToast(message: string, variant: Toast["variant"] = "info") {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function refreshJob(jobId: string) {
    const res = await fetch(`/api/dashboard/import-jobs/${jobId}`);
    if (!res.ok) {
      throw new Error("Não foi possível recuperar o progresso.");
    }
    const payload = await res.json();
    setJob(payload.job);

    if (payload.job?.status === "COMPLETED") {
      pushToast("Importação concluída!", "success");
      stopPolling();
    }
    if (payload.job?.status === "FAILED") {
      pushToast(payload.job.errorMessage || "Falha ao processar o CSV.", "error");
      stopPolling();
    }
  }

  useEffect(() => {
    if (!job) return;
    if (job.status === lastStatus.current) return;

    if (job.status === "COMPLETED") {
      pushToast("Importação concluída!", "success");
    }
    if (job.status === "FAILED") {
      pushToast(job.errorMessage || "Falha ao processar o CSV.", "error");
    }

    lastStatus.current = job.status;
  }, [job]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Selecione um arquivo CSV para importar.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadedAt", new Date().toISOString());

    try {
      const res = await fetch("/api/dashboard/import-jobs", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Falha ao criar job de importação.");
      }

      const payload = await res.json();
      setJob(payload.job);
      lastStatus.current = payload.job?.status ?? null;

      stopPolling();
      pollRef.current = setInterval(() => {
        void refreshJob(payload.job.id);
      }, POLL_INTERVAL);

      if (payload.deduped) {
        pushToast("Job reaproveitado (idempotente).", "info");
      } else {
        pushToast("Job enfileirado com sucesso!", "success");
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar importação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white/40 p-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800">Arquivo CSV</label>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="w-full rounded border px-3 py-2 text-sm"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <p className="text-xs text-gray-500">
            O job será deduplicado por usuário, tenant, nome do arquivo e timestamp enviado.
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Enfileirando..." : "Enviar para processamento"}
        </button>
      </form>

      {job ? (
        <div className="space-y-3 rounded-lg border bg-white/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Job #{job.id.slice(0, 8)}</p>
              <p className="text-xs text-gray-500">{job.filename}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {formatStatus(job.status)}
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${job.status === "FAILED" ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">
            {job.processedRows} de {job.totalRows || "?"} linhas processadas ({progress}%).
          </p>

          {job.errorMessage ? <p className="text-xs text-red-600">{job.errorMessage}</p> : null}
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-4 right-4 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-lg ${
              toast.variant === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : toast.variant === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
