import { NextResponse } from "next/server";

import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/features";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireScheduling(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth?.tenant) return { auth: null, error: error("Acesso restrito ao tenant", 401) };
  if (!featureEnabled(auth, "scheduling")) {
    return { auth: null, error: error("Plugin de agendamento desabilitado", 403) };
  }
  const membership = auth.user.memberships.find((m) => m.tenantId === auth.tenant?.id);
  if (!membership) return { auth: null, error: error("Usuário sem vínculo com o tenant", 403) };
  return { auth, membership };
}

function presentAppointment(appointment: any) {
  return {
    id: appointment.id,
    customerName: appointment.customerName,
    customerEmail: appointment.customerEmail,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    notes: appointment.notes,
    professionalId: appointment.professionalId,
    professionalName: appointment.professional?.name,
    professionalTitle: appointment.professional?.title,
  };
}

export async function GET(req: Request) {
  const { auth, error: err } = await requireScheduling(req);
  if (!auth) return err;

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: auth.tenant!.id },
    include: { professional: true },
    orderBy: { startsAt: "asc" },
    take: 20,
  });

  return NextResponse.json(appointments.map(presentAppointment));
}

export async function POST(req: Request) {
  const { auth, error: err } = await requireScheduling(req);
  if (!auth) return err;

  const body = await req.json();
  const professionalId = String(body?.professionalId || "").trim();
  const customerName = String(body?.customerName || "").trim();
  const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;
  const startsAt = body?.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!professionalId || !customerName || !startsAt || !endsAt) {
    return error("Campos obrigatórios: profissional, cliente, início e fim");
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return error("Datas inválidas", 400);
  }
  if (endsAt <= startsAt) {
    return error("O horário de término deve ser após o início", 400);
  }

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, tenantId: auth.tenant!.id },
  });
  if (!professional) return error("Profissional não encontrado", 404);

  const created = await prisma.appointment.create({
    data: {
      tenantId: auth.tenant!.id,
      professionalId,
      customerName,
      customerEmail,
      startsAt,
      endsAt,
      notes,
    },
    include: { professional: true },
  });

  return NextResponse.json(presentAppointment(created), { status: 201 });
}
