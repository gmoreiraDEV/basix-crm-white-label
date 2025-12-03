"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["text/csv", "application/vnd.ms-excel", "application/csv"];

const crmOptions = [
  { value: "pipedrive", label: "Pipedrive" },
  { value: "hubspot", label: "HubSpot" },
  { value: "rd-station", label: "RD Station" },
  { value: "outro", label: "Outro" },
];

export default function CsvImportPage() {
  const [selectedCrm, setSelectedCrm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fileLabel = useMemo(() => file?.name || "Arraste ou selecione um arquivo CSV", [file]);

  useEffect(() => {
    if (!uploading) return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 5 : prev));
    }, 150);
    return () => clearInterval(interval);
  }, [uploading]);

  const validateFile = (candidate: File) => {
    if (!candidate) return false;
    if (!ALLOWED_TYPES.includes(candidate.type) && !candidate.name.toLowerCase().endsWith(".csv")) {
      setError("Envie um arquivo .csv válido");
      return false;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Limite de 5MB excedido");
      return false;
    }
    return true;
  };

  const handleFile = (candidate: File | null) => {
    if (!candidate) return;
    setSuccessMessage("");
    if (validateFile(candidate)) {
      setError(null);
      setFile(candidate);
    } else {
      setFile(null);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      handleFile(event.dataTransfer.files[0]);
    }
  };

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = event.target.files?.[0] ?? null;
    if (candidate) handleFile(candidate);
  };

  const handleUpload = async () => {
    if (!selectedCrm) {
      setError("Selecione a origem do CRM");
      return;
    }
    if (!file) {
      setError("Escolha um arquivo CSV para enviar");
      return;
    }

    setUploading(true);
    setProgress(10);
    setError(null);
    setSuccessMessage("");

    try {
      const response = await fetch("/api/importacoes/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: selectedCrm,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Falha ao salvar metadados");
      }

      setProgress(100);
      setSuccessMessage("Metadados registrados e arquivo enviado com sucesso.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar";
      setError(message);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card space-y-4">
        <div>
          <p className="text-sm text-gray-500">Ferramentas</p>
          <h1 className="text-2xl font-semibold">Importação de contatos via CSV</h1>
          <p className="text-gray-600 text-sm">Suba um arquivo CSV formatado corretamente para iniciar sua importação.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Origem do CRM</label>
            <select
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-400 focus:outline-none"
              value={selectedCrm}
              onChange={(event) => setSelectedCrm(event.target.value)}
              disabled={uploading}
            >
              <option value="">Selecione...</option>
              {crmOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Informe de qual CRM o arquivo foi exportado para rastrearmos a origem.</p>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Template e formatação</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed">
              <ul className="list-disc space-y-1 pl-4 text-gray-700">
                <li>Codificação UTF-8 e separador "," ou ";".</li>
                <li>Headers esperados: <strong>email, nome, telefone, origem</strong>.</li>
                <li>
                  Baixe um modelo pronto: {" "}
                  <Link className="text-primary underline" href="/templates/importacao.csv" download>
                    CSV de exemplo
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Arquivo CSV</label>
          <div
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center",
              file ? "border-primary bg-primary/5" : "hover:border-gray-400"
            )}
          >
            <p className="text-sm font-medium text-gray-700">{fileLabel}</p>
            <p className="text-xs text-gray-500">Tamanho máximo: 5MB. Apenas CSV.</p>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                Selecionar arquivo
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,application/csv"
                className="hidden"
                onChange={onSelectFile}
                disabled={uploading}
              />
              {file ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)} disabled={uploading}>
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="button" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Enviando..." : "Enviar arquivo"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {successMessage ? <p className="text-sm text-green-600">{successMessage}</p> : null}
        </div>

        {uploading || progress > 0 ? (
          <div className="w-full rounded-full bg-gray-100 p-1">
            <div
              className="h-2 rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
