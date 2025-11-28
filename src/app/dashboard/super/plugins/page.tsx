"use client";

import { useEffect, useState } from "react";

import { featureCatalog } from "@/lib/features";

type PluginToggle = { key: string; name: string; enabled: boolean };
type TenantPlugins = { id: string; name: string; plan: string; plugins: PluginToggle[] };

type BusyState = { tenantId: string; pluginKey: string } | null;

export default function SuperPluginsPage() {
  const [rows, setRows] = useState<TenantPlugins[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/super/plugins");
    if (!res.ok) {
      setError("Sem permissão ou erro ao carregar os tenants.");
      return;
    }
    setRows(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(tenantId: string, pluginKey: string, current: boolean) {
    setBusy({ tenantId, pluginKey });
    const res = await fetch("/api/super/plugins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, pluginKey, enabled: !current }),
    });
    if (!res.ok) {
      setError((await res.json())?.error || "Erro ao salvar toggle");
    } else {
      setRows((prev) =>
        prev.map((row) =>
          row.id !== tenantId
            ? row
            : {
                ...row,
                plugins: row.plugins.map((plugin) =>
                  plugin.key === pluginKey ? { ...plugin, enabled: !current } : plugin
                ),
              }
        )
      );
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">Plugins por tenant</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Somente Super Admins podem alterar estes toggles. Plugins disponíveis são determinados pelo plano do tenant.
        </p>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {rows.map((tenant) => (
        <div key={tenant.id} className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{tenant.name}</div>
              <div className="text-sm text-gray-500">Plano: {tenant.plan}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenant.plugins.map((plugin) => (
              <label
                key={plugin.key}
                className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 hover:border-gray-300"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={plugin.enabled}
                  disabled={busy?.tenantId === tenant.id && busy.pluginKey === plugin.key}
                  onChange={() => toggle(tenant.id, plugin.key, plugin.enabled)}
                />
                <div>
                  <div className="font-medium">{plugin.name}</div>
                  <p className="text-xs text-gray-500">
                    {featureCatalog[plugin.key as keyof typeof featureCatalog]?.description || "Recurso do plano"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
