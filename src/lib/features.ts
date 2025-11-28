import { AuthContext } from "@/lib/auth-context";

export type FeatureKey =
  | "overview"
  | "support"
  | "crm"
  | "contacts"
  | "dashboards"
  | "campaigns"
  | "chatbots"
  | "apps"
  | "reports"
  | "settings";

export const featureCatalog: Record<FeatureKey, { label: string; description: string; href?: string }> = {
  overview: {
    label: "Visão geral",
    description: "KPIs consolidados e atalhos principais.",
    href: "/dashboard",
  },
  support: {
    label: "Atendimentos",
    description: "Fila, conversas e detalhes do chat.",
    href: "/dashboard/atendimentos",
  },
  crm: {
    label: "CRM",
    description: "Funil de vendas e oportunidades.",
    href: "/dashboard/crm",
  },
  contacts: {
    label: "Contatos",
    description: "Base de clientes e leads.",
    href: "/dashboard/contatos",
  },
  dashboards: {
    label: "Painéis",
    description: "KPIs e gráficos personalizáveis.",
    href: "/dashboard/painel",
  },
  campaigns: {
    label: "Campanhas",
    description: "Criação e orquestração de campanhas.",
    href: "/dashboard/campanhas",
  },
  chatbots: {
    label: "Chatbots",
    description: "Bots e automações de atendimento.",
    href: "/dashboard/chatbots",
  },
  apps: {
    label: "Apps",
    description: "Apps internos e integrações.",
    href: "/dashboard/apps",
  },
  reports: {
    label: "Relatórios",
    description: "Relatórios e exportações.",
    href: "/dashboard/relatorios",
  },
  settings: {
    label: "Ajustes",
    description: "Configurações gerais da conta.",
    href: "/dashboard/ajustes",
  },
};

export const navItems = Object.entries(featureCatalog).map(([key, item]) => ({
  href: item.href ?? "/dashboard",
  label: item.label,
  featureKey: key as FeatureKey,
}));

export const superAdminNav = { href: "/dashboard/super/plugins", label: "Super Admin", requiresRole: "SUPER_ADMIN" } as const;

export function featureEnabled(auth: AuthContext | null, key: FeatureKey) {
  return !!auth?.enabledPlugins?.includes(key);
}

export function visibleNavItems(auth: AuthContext | null) {
  const enabled = new Set(auth?.enabledPlugins ?? []);
  const items = Object.entries(featureCatalog).map(([key, value]) => ({
    featureKey: key as FeatureKey,
    href: value.href ?? "/dashboard",
    label: value.label,
  }));

  return items.filter((item) => enabled.has(item.featureKey));
}
