import { FeatureUnavailable } from "@/components/feature-unavailable";
import ApiKeysPanel from "@/app/dashboard/ajustes/api-keys-panel";
import { getAuthContextFromCookies } from "@/lib/auth-context";
import { AVAILABLE_API_SCOPES, presentApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";

export default async function Page() {
  const auth = await getAuthContextFromCookies();

  if (!auth?.tenant || !featureEnabled(auth, "settings")) {
    return (
      <FeatureUnavailable
        featureKey="settings"
        planName={auth?.tenant?.subscriptionPlan.name}
        description="Gerencie ajustes gerais, branding e chaves de API do tenant."
      />
    );
  }

  const apiKeys = await prisma.tenantApiKey.findMany({
    where: { tenantId: auth.tenant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <p className="text-gray-600 text-sm">
          Configure o workspace, faça o gerenciamento de acessos externos e compartilhe integrações.
        </p>
      </div>

      <ApiKeysPanel
        initialKeys={apiKeys.map((key) => ({
          ...presentApiKey(key),
          createdAt: key.createdAt.toISOString(),
          revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
        }))}
        availableScopes={AVAILABLE_API_SCOPES}
      />
    </div>
  );
}
