"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ProfessionalDTO = {
  id: string;
  name: string;
  title?: string;
  createdAt: string;
};

export type AppointmentDTO = {
  id: string;
  professionalId: string;
  professionalName: string;
  professionalTitle?: string;
  customerName: string;
  customerEmail?: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string;
};

type Props = {
  initialProfessionals: ProfessionalDTO[];
  initialAppointments: AppointmentDTO[];
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (err) {
    return value;
  }
}

export default function SchedulingClient({ initialProfessionals, initialAppointments }: Props) {
  const [professionals, setProfessionals] = useState(initialProfessionals);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [savingProfessional, setSavingProfessional] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    initialProfessionals[0]?.id || ""
  );

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort((a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
    [appointments]
  );

  async function createProfessional(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSavingProfessional(true);
    const res = await fetch("/api/dashboard/scheduling/professionals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: professionalName, title: professionalTitle }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Erro ao criar profissional");
    } else {
      setProfessionals((prev) => [...prev, { ...data, createdAt: data.createdAt }]);
      if (!selectedProfessionalId) {
        setSelectedProfessionalId(data.id);
      }
      setMessage(`Profissional ${data.name} criado com sucesso.`);
      setProfessionalName("");
      setProfessionalTitle("");
    }
    setSavingProfessional(false);
  }

  async function createAppointment(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSavingAppointment(true);
    const res = await fetch("/api/dashboard/scheduling/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professionalId: selectedProfessionalId,
        customerName,
        customerEmail,
        startsAt,
        endsAt,
        notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Erro ao criar agendamento");
    } else {
      setAppointments((prev) => [...prev, data]);
      setMessage(`Agendamento criado para ${data.customerName}.`);
      setCustomerName("");
      setCustomerEmail("");
      setStartsAt("");
      setEndsAt("");
      setNotes("");
    }
    setSavingAppointment(false);
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">Agendamentos</h1>
        <p className="text-gray-600 text-sm">
          Centralize horários e reuniões por profissional e exponha a API externa com chaves por
          tenant.
        </p>
        {message && <p className="text-green-700 text-sm">{message}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold">Profissionais do tenant</h2>
            <p className="text-sm text-gray-600">Cadastre quem pode receber reuniões.</p>
          </div>

          <form onSubmit={createProfessional} className="space-y-3">
            <div>
              <label className="text-sm text-gray-700">Nome</label>
              <Input
                value={professionalName}
                onChange={(e) => setProfessionalName(e.target.value)}
                placeholder="Ex: Ana Paula"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Título ou cargo</label>
              <Input
                value={professionalTitle}
                onChange={(e) => setProfessionalTitle(e.target.value)}
                placeholder="Consultora, CS, etc"
              />
            </div>
            <Button type="submit" disabled={savingProfessional}>
              {savingProfessional ? "Salvando..." : "Adicionar profissional"}
            </Button>
          </form>

          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {professionals.length === 0 && (
              <p className="p-3 text-sm text-gray-600">Nenhum profissional cadastrado.</p>
            )}
            {professionals.map((pro) => (
              <div key={pro.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{pro.name}</div>
                  {pro.title && <div className="text-xs text-gray-500">{pro.title}</div>}
                </div>
                <div className="text-xs text-gray-500">Desde {formatDate(pro.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold">Novo agendamento</h2>
            <p className="text-sm text-gray-600">Registre uma reunião com um profissional.</p>
          </div>

          <form onSubmit={createAppointment} className="space-y-3">
            <div>
              <label className="text-sm text-gray-700">Profissional</label>
              <select
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                value={selectedProfessionalId}
                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {professionals.map((pro) => (
                  <option key={pro.id} value={pro.id}>
                    {pro.name} {pro.title ? `- ${pro.title}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Nome do cliente</label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Cliente ou lead"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">E-mail</label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@cliente.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Início</label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Fim</label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-700">Notas</label>
              <textarea
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contexto do atendimento, link da reunião, etc"
              />
            </div>
            <Button type="submit" disabled={savingAppointment || professionals.length === 0}>
              {savingAppointment ? "Criando..." : "Criar agendamento"}
            </Button>
          </form>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Próximos horários</h2>
            <p className="text-sm text-gray-600">
              A lista considera os 20 compromissos mais recentes criados.
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {sortedAppointments.length === 0 && (
            <p className="p-3 text-sm text-gray-600">Nenhum agendamento registrado.</p>
          )}
          {sortedAppointments.map((appt) => (
            <div key={appt.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
              <div>
                <div className="font-medium">{appt.customerName}</div>
                <div className="text-xs text-gray-600">
                  {formatDate(appt.startsAt)} - {formatDate(appt.endsAt)}
                </div>
                <div className="text-xs text-gray-500">
                  {appt.professionalName}
                  {appt.professionalTitle ? ` • ${appt.professionalTitle}` : ""}
                </div>
                {appt.customerEmail && (
                  <div className="text-xs text-gray-500">{appt.customerEmail}</div>
                )}
                {appt.notes && <div className="text-xs text-gray-500">{appt.notes}</div>}
              </div>
              <span className="self-start rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {appt.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Integração via API Key</h2>
        <p className="text-sm text-gray-600">
          Use o cabeçalho <code>x-api-key</code> com um dos escopos permitidos para ler profissionais ou
          criar agendamentos. Endpoints públicos:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li><code>GET /api/public/scheduling/professionals</code> (escopo scheduling:professionals:read)</li>
          <li><code>POST /api/public/scheduling/appointments</code> (escopo scheduling:appointments:write)</li>
          <li><code>GET /api/public/scheduling/appointments</code> (escopo scheduling:appointments:read)</li>
        </ul>
      </div>
    </div>
  );
}
