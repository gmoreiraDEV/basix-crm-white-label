'use client';
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setEmail(d?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-xl font-semibold mb-2">Visão geral</h1>
        <p className="text-gray-600">
          Olá{email ? `, ${email}` : ""}! Aqui virão os KPIs e atalhos.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {[
          { title: "Atendimentos", href: "/dashboard/atendimentos" },
          { title: "CRM", href: "/dashboard/crm" },
          { title: "Contatos", href: "/dashboard/contatos" },
          { title: "Painéis", href: "/dashboard/painels" },
        ].map((i) => (
          <Link key={i.href} href={i.href} className="card">
            <div className="text-lg font-medium">{i.title}</div>
            <div className="mt-4 h-24 rounded-xl border border-dashed border-gray-300 bg-gray-50" />
          </Link>
        ))}
      </div>
    </div>
  );
}