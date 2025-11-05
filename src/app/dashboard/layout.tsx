import Link from "next/link";
import { ReactNode } from "react";

const nav = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/atendimentos", label: "Atendimentos" },
  { href: "/dashboard/crm", label: "CRM" },
  { href: "/dashboard/contatos", label: "Contatos" },
  { href: "/dashboard/painels", label: "Painéis" },
  { href: "/dashboard/campanhas", label: "Campanhas" },
  { href: "/dashboard/chatbots", label: "Chatbots" },
  { href: "/dashboard/apps", label: "Apps" },
  { href: "/dashboard/relatorios", label: "Relatórios" },
  { href: "/dashboard/ajustes", label: "Ajustes" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <aside className="bg-white rounded-2xl shadow p-4 h-max">
        <div className="font-semibold mb-3">Dashboard</div>
        <nav className="space-y-2">
          {nav.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="block rounded-lg px-3 py-2 hover:bg-gray-100 text-sm"
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}