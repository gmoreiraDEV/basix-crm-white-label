import { FeatureUnavailable } from "@/components/feature-unavailable";
import { getAuthContextFromCookies } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";
import SchedulingClient from "./scheduling-client";

export default async function Page() {
  const auth = await getAuthContextFromCookies();
  if (!auth?.tenant || !featureEnabled(auth, "scheduling")) {
    return (
      <FeatureUnavailable
        featureKey="scheduling"
        planName={auth?.tenant?.subscriptionPlan.name}
        description="Habilite o plugin de Agendamentos para registrar compromissos com seus profissionais."
      />
    );
  }

  const professionals = await prisma.professional.findMany({
    where: { tenantId: auth.tenant.id },
    orderBy: { createdAt: "asc" },
  });

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: auth.tenant.id },
    include: { professional: true },
    orderBy: { startsAt: "asc" },
    take: 20,
  });

  const serializedProfessionals = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title ?? "",
    createdAt: p.createdAt.toISOString(),
  }));

  const serializedAppointments = appointments.map((appointment) => ({
    id: appointment.id,
    customerName: appointment.customerName,
    customerEmail: appointment.customerEmail ?? "",
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    status: appointment.status,
    notes: appointment.notes ?? "",
    professionalId: appointment.professionalId,
    professionalName: appointment.professional?.name ?? "",
    professionalTitle: appointment.professional?.title ?? "",
  }));

  return (
    <SchedulingClient
      initialProfessionals={serializedProfessionals}
      initialAppointments={serializedAppointments}
    />
  );
}
