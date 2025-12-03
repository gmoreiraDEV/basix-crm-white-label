"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ApiKeyDTO = {
  id: string;
  name: string;
  scopes: string[];
  preview: string;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
};

type Props = {
  initialKeys: ApiKeyDTO[];
  availableScopes: Record<string, string>;
};

export default function ApiKeysPanel({ initialKeys, availableScopes }: Props) {
  const [keys, setKeys] = useState<ApiKeyDTO[]>(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(Object.keys(availableScopes));
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scopeList = useMemo(
    () => Object.entries(availableScopes).map(([key, description]) => ({ key, description })),
    [availableScopes]
  );

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((item) => item !== scope) : [...prev, scope]
    );
  }

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSecret(null);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/dashboard/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Erro ao criar chave");
    } else {
      setMessage(`Chave ${data.apiKey.name} criada com sucesso.`);
      setSecret(data.secret);
      setKeys((prev) => [data.apiKey, ...prev]);
      setName("");
    }
    setBusy(false);
  }

  async function revoke(id: string) {
    setBusy(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/dashboard/api-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, revoked: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Erro ao revogar chave");
    } else {
      setKeys((prev) => prev.map((key) => (key.id === id ? data : key)));
      setMessage("Chave revogada");
    }
    setBusy(false);
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Chaves de API por tenant</h2>
            <p className="text-sm text-gray-600">
              Restrinja escopos e compartilhe apenas o segredo exibido uma única vez.
            </p>
          </div>
        </div>
        {message && <p className="text-green-700 text-sm">{message}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {secret && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="font-medium text-amber-800">Chave gerada (copie agora):</div>
            <code className="block break-all text-amber-800">{secret}</code>
          </div>
        )}
      </div>

      <form onSubmit={createKey} className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="text-sm text-gray-700">Nome</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Integração Zapier"
            required
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <div className="text-sm text-gray-700">Escopos permitidos</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {scopeList.map((scope) => (
              <label
                key={scope.key}
                className="flex gap-2 rounded-lg border border-gray-200 p-2 text-sm hover:border-gray-300"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope.key)}
                  onChange={() => toggleScope(scope.key)}
                />
                <div>
                  <div className="font-medium">{scope.key}</div>
                  <div className="text-xs text-gray-600">{scope.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 flex items-center justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Gerar API Key"}
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="font-semibold">Chaves existentes</h3>
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {keys.length === 0 && (
            <p className="p-3 text-sm text-gray-600">Nenhuma chave criada ainda.</p>
          )}
          {keys.map((key) => (
            <div key={key.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="font-medium">{key.name}</div>
                <div className="text-xs text-gray-500">Pré-visualização: ...{key.preview}</div>
                <div className="text-xs text-gray-500">Escopos: {key.scopes.join(", ")}</div>
                <div className="text-xs text-gray-500">Criada em {new Date(key.createdAt).toLocaleString("pt-BR")}</div>
                {key.revoked && (
                  <div className="text-xs text-red-600">Revogada {key.revokedAt ? `em ${new Date(key.revokedAt).toLocaleString("pt-BR")}` : ""}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {key.revoked ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">Revogada</span>
                ) : (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => revoke(key.id)}>
                    Revogar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
