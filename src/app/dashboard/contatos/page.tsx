import { FeatureUnavailable } from "@/components/feature-unavailable";
import { CrmImporter } from "@/app/dashboard/contatos/crm-importer";
import { getAuthContextFromCookies } from "@/lib/auth-context";
import { featureCatalog, featureEnabled } from "@/lib/features";

export default async function Page() {
  const auth = await getAuthContextFromCookies();
  const featureKey = "contacts" as const;

  if (!featureEnabled(auth, featureKey)) {
    return (
      <FeatureUnavailable
        featureKey={featureKey}
        planName={auth?.tenant?.subscriptionPlan.name}
        description={featureCatalog[featureKey].description}
      />
    );
  }

  return <CrmImporter />;
}
