import { FeatureUnavailable } from "@/components/feature-unavailable";
import { getAuthContextFromCookies } from "@/lib/auth-context";
import { featureCatalog, featureEnabled } from "@/lib/features";
import { CrmImporter } from "@/app/dashboard/contatos/crm-importer";
import { getAuthContextFromCookies } from "@/lib/auth-context";
import { featureCatalog, featureEnabled } from "@/lib/features";

import { ImportJobClient } from "./import-job-client";

export default async function Page() {
  const auth = await getAuthContextFromCookies();
  const featureKey = "contacts" as const;

  if (!featureEnabled(auth, "contacts")) {
    const feature = featureCatalog.contacts;
    return (
      <FeatureUnavailable
        featureKey="contacts"
        planName={auth?.tenant?.subscriptionPlan.name}
        description={feature.description}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Importação de contatos</h1>
        <p className="text-sm text-gray-600">
          Envie um CSV para processamento em background com acompanhamento de progresso e deduplicação automática.
        </p>
      </div>

      <ImportJobClient />
    </div>
  );
}