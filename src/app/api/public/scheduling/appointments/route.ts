import { NextResponse } from "next/server";

import { authenticateApiKeyRequest } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { tenantPluginEnabled } from "@/lib/plugins";

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
  const auth = await authenticateApiKeyRequest(req, ["scheduling:appointments:read"]);
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const pluginEnabled = await tenantPluginEnabled(auth.apiKey.tenantId, "scheduling");
  if (!pluginEnabled) {
    return NextResponse.json({ error: "Plugin de agendamento desativado" }, { status: 403 });
  }

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: auth.apiKey.tenantId },
    include: { professional: true },
    orderBy: { startsAt: "asc" },
    take: 20,
  });

  return NextResponse.json(appointments.map(presentAppointment));
}

export async function POST(req: Request) {
  const auth = await authenticateApiKeyRequest(req, ["scheduling:appointments:write"]);
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const pluginEnabled = await tenantPluginEnabled(auth.apiKey.tenantId, "scheduling");
  if (!pluginEnabled) {
    return NextResponse.json({ error: "Plugin de agendamento desativado" }, { status: 403 });
  }

  const body = await req.json();
  const professionalId = String(body?.professionalId || "").trim();
  const customerName = String(body?.customerName || "").trim();
  const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;
  const startsAt = body?.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!professionalId || !customerName || !startsAt || !endsAt) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return NextResponse.json({ error: "O término deve ser após o início" }, { status: 400 });
  }

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, tenantId: auth.apiKey.tenantId },
  });
  if (!professional) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }

  const created = await prisma.appointment.create({
    data: {
      tenantId: auth.apiKey.tenantId,
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
