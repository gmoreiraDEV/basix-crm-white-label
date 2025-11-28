import Link from "next/link";

import { getAuthContextFromCookies } from "@/lib/auth-context";
import { enabledPluginsSet } from "@/lib/feature-pages";
import { featureCatalog, FeatureKey } from "@/lib/features";

const quickLinks: FeatureKey[] = ["support", "crm", "contacts", "dashboards"];

export default async function Dashboard() {
  const auth = await getAuthContextFromCookies();
  const enabled = enabledPluginsSet(auth);
  const availableLinks = quickLinks.filter((key) => enabled.has(key));

  return (
    <div className="space-y-6 w-full">
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Visão geral</h1>
        <p className="text-gray-600">
          Olá{auth?.user?.email ? `, ${auth.user.email}` : ""}! Você está em
          {" "}
          <span className="font-semibold">{auth?.tenant?.name ?? "workspace"}</span> com o plano
          {" "}
          <span className="font-semibold">{auth?.tenant?.subscriptionPlan.name ?? "-"}</span>.
        </p>
        <p className="text-gray-500 text-sm">
          Plugins habilitados: {auth?.enabledPlugins.length ? auth.enabledPlugins.join(", ") : "nenhum"}.
        </p>
      </div>

      {availableLinks.length ? (
        <div className="grid md:grid-cols-2 gap-6">
          {availableLinks.map((key) => {
            const item = featureCatalog[key];
            return (
              <Link key={key} href={item.href ?? "/dashboard"} className="card">
                <div className="text-lg font-medium">{item.label}</div>
                <p className="text-gray-500 text-sm mt-1">{item.description}</p>
                <div className="mt-4 h-24 rounded-xl border border-dashed border-gray-300 bg-gray-50" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h2 className="text-lg font-semibold">Nenhum plugin habilitado</h2>
          <p className="text-gray-600 mt-2">
            Solicite a um administrador para ativar recursos neste tenant ou faça upgrade de plano.
          </p>
        </div>
      )}
    </div>
  );
}
