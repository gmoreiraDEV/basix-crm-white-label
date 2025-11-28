import { FeatureUnavailable } from "@/components/feature-unavailable";
import { Empty } from "@/components/empty";
import { AuthContext, getAuthContextFromCookies } from "@/lib/auth-context";
import { FeatureKey, featureCatalog, featureEnabled } from "@/lib/features";

export async function renderFeaturePage(featureKey: FeatureKey, fallbackDescription?: string) {
  const auth = await getAuthContextFromCookies();
  const feature = featureCatalog[featureKey];
  if (!featureEnabled(auth, featureKey)) {
    return (
      <FeatureUnavailable
        featureKey={featureKey}
        planName={auth?.tenant?.subscriptionPlan.name}
        description={fallbackDescription}
      />
    );
  }

  return (
    <Empty
      title={feature?.label ?? featureKey}
      description={fallbackDescription || feature?.description}
    />
  );
}

export function enabledPluginsSet(auth: AuthContext | null) {
  return new Set(auth?.enabledPlugins ?? []);
}
