"use client";

import { useMemo, useState } from "react";

import {
  InternalRecordType,
  ManualMapping,
  InternalFieldTarget,
  availableInternalTargets,
  describeTarget,
  detectCrmProvider,
  internalFieldContract,
  normalizeCsvRows,
} from "@/lib/crm-normalizer";

const sampleRows = [
  {
    firstname: "Ana",
    lastname: "Silva",
    email: "ana@empresa.com",
    phone: "+55 11 99999-9999",
    company: "ACME Ltda",
    lifecyclestage: "lead",
    jobtitle: "Diretora de Operações",
  },
  {
    firstname: "Bruno",
    lastname: "Gomes",
    email: "bruno@startup.com",
    phone: "+55 21 98888-0000",
    company: "GrowthX",
    lifecyclestage: "opportunity",
    jobtitle: "Growth Lead",
  },
];

const unmatchedExampleRow = {
  "Primeiro Nome": "Camila",
  "Ultimo Nome": "Santos",
  Email: "camila@consultoria.com",
  Telefone: "+55 31 91234-5678",
  Empresa: "Consultoria Pro",
  Cargo: "Analista",
  Status: "novo",
};

function ManualMappingBoard({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: ManualMapping;
  onChange: (header: string, target: InternalFieldTarget) => void;
}) {
  const targets = useMemo(() => availableInternalTargets(), []);

  return (
    <div className="rounded-lg border bg-white/40 p-4">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold">Fallback manual</h3>
        <p className="text-sm text-gray-600">
          Arraste um header para o campo interno correspondente ou selecione no dropdown. Útil quando o CSV não
          segue o naming do CRM.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Headers detectados</p>
          <ul className="space-y-2">
            {headers.map((header) => (
              <li
                key={header}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", header)}
                className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span>{header}</span>
                <span className="text-xs text-gray-500">arraste</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Campos internos</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {targets.map((target) => (
              <div
                key={target}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const header = event.dataTransfer.getData("text/plain");
                  if (header) onChange(header, target);
                }}
                className="rounded-md border border-dashed bg-white px-3 py-2 text-sm shadow-sm"
              >
                <div className="text-xs uppercase text-gray-500">{target}</div>
                <div className="font-medium">{describeTarget(target)}</div>
                <select
                  value={Object.entries(mapping).find(([, mapped]) => mapped === target)?.[0] ?? ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    onChange(event.target.value, target);
                  }}
                  className="mt-2 w-full rounded border px-2 py-1 text-sm"
                >
                  <option value="">Selecione um header</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrmImporter() {
  const [selectedProvider, setSelectedProvider] = useState<"hubspot" | "pipedrive" | null>(null);
  const [manualMapping, setManualMapping] = useState<ManualMapping>({});
  const csvRows = useMemo(() => [...sampleRows, unmatchedExampleRow], []);
  const demoHeaders = useMemo(() => Array.from(new Set(csvRows.flatMap(Object.keys))), [csvRows]);
  const detectedProvider = detectCrmProvider({
    selectedOption: selectedProvider,
    csvHeaders: demoHeaders,
    requestHeaders: { "x-crm-provider": undefined },
  });

  const { rows, errors, unmatchedHeaders } = useMemo(
    () => normalizeCsvRows(csvRows, { provider: detectedProvider, manualMapping }),
    [csvRows, detectedProvider, manualMapping]
  );

  const headersForManual = unmatchedHeaders.length ? unmatchedHeaders : demoHeaders;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-indigo-700">Importação de contatos</p>
        <h1 className="text-2xl font-bold text-gray-900">Normalização de CSV por CRM</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Definimos um contrato interno de campos para leads, contatos e empresas e mapeamos as variações de headers
          de CRMs populares. A detecção automática escolhe o provedor mais provável, normaliza cada linha e captura
          inconsistências para revisão.
        </p>
      </header>

      <section className="rounded-lg border bg-white/60 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">CRM detectado</p>
            <p className="text-lg font-semibold text-gray-900">{detectedProvider ?? "Nenhum"}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Selecionar manualmente:</span>
            <select
              className="rounded border px-2 py-1"
              value={selectedProvider ?? ""}
              onChange={(event) => setSelectedProvider(event.target.value ? (event.target.value as any) : null)}
            >
              <option value="">Automático</option>
              <option value="hubspot">HubSpot</option>
              <option value="pipedrive">Pipedrive</option>
            </select>
          </div>
          <div className="text-sm text-gray-600">Headers analisados: {demoHeaders.join(", ")}</div>
        </div>
      </section>

      <section className="rounded-lg border bg-white/60 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Contrato interno</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {(Object.keys(internalFieldContract) as InternalRecordType[]).map((recordType) => (
            <div key={recordType} className="rounded-md border bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">{recordType.toUpperCase()}</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {internalFieldContract[recordType].map((field) => (
                  <li key={field.key} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{field.label}</div>
                      {field.description ? <div className="text-xs text-gray-500">{field.description}</div> : null}
                    </div>
                    {field.required ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        obrigatório
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Resultado da normalização</h2>
          <div className="text-sm text-gray-600">Linhas avaliadas: {rows.length}</div>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-800">Payload interno</p>
            <pre className="mt-2 overflow-auto text-xs text-gray-800">{JSON.stringify(rows, null, 2)}</pre>
          </div>
          <div className="rounded-md border bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-800">Erros e avisos</p>
            {errors.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700">Nenhum erro encontrado.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-red-700">
                {errors.map((error, index) => (
                  <li key={`${error.field}-${index}`} className="rounded bg-red-50 px-2 py-1">
                    <strong>Linha {error.row}:</strong> {error.message} ({error.field})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {unmatchedHeaders.length ? (
          <p className="mt-3 text-sm text-amber-700">
            Headers não mapeados automaticamente: {unmatchedHeaders.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border bg-white/60 p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">Fallback/manual mapping</h2>
          <p className="text-sm text-gray-600">
            Quando os headers fogem do padrão do CRM, habilitamos um canvas simples para selecionar ou arrastar cada
            coluna para seu campo interno. Os mapeamentos são aplicados antes da normalização e reduzem o número de
            erros de campos obrigatórios.
          </p>
        </div>
        <ManualMappingBoard
          headers={headersForManual}
          mapping={manualMapping}
          onChange={(header, target) =>
            setManualMapping((current) => ({
              ...current,
              [header]: target,
            }))
          }
        />
      </section>
    </div>
  );
}
