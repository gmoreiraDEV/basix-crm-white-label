import { FeatureUnavailable } from "@/components/feature-unavailable";
import { ImportCsvPanel } from "@/app/dashboard/crm/import-csv-panel";
import { getAuthContextFromCookies } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";

export default async function Page() {
  const auth = await getAuthContextFromCookies();

  if (!auth || !auth.tenant || !featureEnabled(auth, "crm")) {
    return (
      <FeatureUnavailable
        featureKey="crm"
        planName={auth?.tenant?.subscriptionPlan.name}
        description="Gerencie o funil e migre dados de CRMs externos via CSV."
      />
    );
  }

  const membership = auth.user.memberships.find((m) => m.tenantId === auth.tenant!.id);
  if (!membership || membership.role === "MEMBER") {
    return (
      <FeatureUnavailable
        featureKey="crm"
        planName={auth.tenant.subscriptionPlan.name}
        description="Apenas owners ou admins do tenant podem validar e importar contatos via CSV."
      />
    );
  }

  const importJobs = await prisma.importJob.findMany({
    where: { tenantId: auth.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">CRM</h1>
        <p className="text-gray-600 text-sm">
          Importe contatos de CRMs externos via CSV, valide mapeamento de campos e acompanhe o histórico de importações.
        </p>
        <p className="text-xs text-gray-500">Recurso restrito a owners e admins do tenant.</p>
      </div>

      <ImportCsvPanel
        initialJobs={importJobs.map((job) => ({
          id: job.id,
          source: job.source,
          fileName: job.fileName,
          status: job.status,
          totalRows: job.totalRows,
          validRows: job.validRows,
          invalidRows: job.invalidRows,
          message: job.message,
          createdAt: job.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
