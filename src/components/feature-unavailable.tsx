import { featureCatalog, FeatureKey } from "@/lib/features";

export function FeatureUnavailable({
  featureKey,
  planName,
  description,
}: {
  featureKey: FeatureKey;
  planName?: string;
  description?: string;
}) {
  const feature = featureCatalog[featureKey];
  return (
    <div className="card">
      <h1 className="text-xl font-semibold">{feature?.label ?? featureKey}</h1>
      <p className="text-gray-600 mt-2">
        Este recurso não está habilitado para o seu plano{planName ? ` (${planName})` : ""}. Solicite
        ao administrador ou faça o upgrade para liberar.
      </p>
      {description && <p className="text-gray-500 mt-2">{description}</p>}
    </div>
  );
}
