import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar"


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

export function AppSidebar() {
  return (
    <Sidebar>
        <SidebarHeader>
            <div className="font-semibold mb-3">Dashboard</div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarGroup>
                {nav.map((i) => (
                    <Link
                    key={i.href}
                    href={i.href}
                    className="block rounded-lg px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                    {i.label}
                    </Link>
                ))}
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter />
    </Sidebar>
  )
}