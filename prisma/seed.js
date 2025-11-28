const { PrismaClient, UserRole, TenantRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const plugins = [
  { key: "overview", name: "Visão geral", description: "KPIs e atalhos consolidados." },
  { key: "support", name: "Atendimentos", description: "Fila, conversas e SLA." },
  { key: "crm", name: "CRM", description: "Funis e oportunidades." },
  { key: "contacts", name: "Contatos", description: "Base de clientes e leads." },
  { key: "dashboards", name: "Painéis", description: "KPIs customizáveis." },
  { key: "campaigns", name: "Campanhas", description: "Disparo de comunicações." },
  { key: "chatbots", name: "Chatbots", description: "Automação de atendimento." },
  { key: "apps", name: "Apps", description: "Integrações e app store." },
  { key: "reports", name: "Relatórios", description: "Exportações e relatórios." },
  { key: "settings", name: "Ajustes", description: "Configurações da conta." },
];

const plans = [
  {
    name: "Básico",
    slug: "basic",
    description: "Funcionalidades essenciais para equipes enxutas.",
    plugins: ["overview", "crm", "contacts", "settings"],
  },
  {
    name: "Pro",
    slug: "pro",
    description: "Suite completa com automações e relatórios.",
    plugins: ["overview", "support", "crm", "contacts", "dashboards", "campaigns", "chatbots", "apps", "reports", "settings"],
  },
];

const tenants = [
  { name: "Acme Corp", slug: "acme", plan: "pro" },
  { name: "Contoso", slug: "contoso", plan: "basic" },
];

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function syncPlugins() {
  const results = {};
  for (const plugin of plugins) {
    const record = await prisma.plugin.upsert({
      where: { key: plugin.key },
      create: plugin,
      update: { name: plugin.name, description: plugin.description, category: plugin.category },
    });
    results[plugin.key] = record;
  }
  return results;
}

async function syncPlans(pluginMap) {
  const records = {};
  for (const plan of plans) {
    const record = await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      create: { name: plan.name, slug: plan.slug, description: plan.description },
      update: { name: plan.name, description: plan.description },
    });

    for (const key of plan.plugins) {
      const plugin = pluginMap[key];
      if (!plugin) continue;
      await prisma.subscriptionPlanPlugin.upsert({
        where: { pluginId_planId: { pluginId: plugin.id, planId: record.id } },
        create: { pluginId: plugin.id, planId: record.id },
        update: {},
      });
    }
    records[plan.slug] = record;
  }
  return records;
}

async function ensureTenant(planRecord, tenantInput) {
  const tenantSlug = slugify(tenantInput.slug || tenantInput.name);
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    create: { name: tenantInput.name, slug: tenantSlug, subscriptionPlanId: planRecord.id },
    update: { name: tenantInput.name, subscriptionPlanId: planRecord.id },
  });

  const planPlugins = await prisma.subscriptionPlan.findUnique({
    where: { id: planRecord.id },
    include: { plugins: { include: { plugin: true } } },
  });

  for (const link of planPlugins?.plugins || []) {
    await prisma.tenantPlugin.upsert({
      where: { tenantId_pluginId: { tenantId: tenant.id, pluginId: link.pluginId } },
      create: { tenantId: tenant.id, pluginId: link.pluginId, enabled: true },
      update: {},
    });
  }

  return tenant;
}

async function ensureUser({ email, name, password, role, tenantId }) {
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password: hash,
      role: role || UserRole.USER,
      defaultTenantId: tenantId,
      memberships: tenantId
        ? {
            create: {
              tenantId,
              role: TenantRole.OWNER,
            },
          }
        : undefined,
    },
    update: {
      name,
      role: role || UserRole.USER,
      defaultTenantId: tenantId || undefined,
    },
    include: { memberships: true },
  });

  if (tenantId) {
    await prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId } },
      create: { userId: user.id, tenantId, role: TenantRole.OWNER },
      update: {},
    });
  }

  return user;
}

async function main() {
  const pluginMap = await syncPlugins();
  const planMap = await syncPlans(pluginMap);

  const tenantRecords = {};
  for (const tenantData of tenants) {
    const plan = planMap[tenantData.plan];
    if (!plan) continue;
    tenantRecords[tenantData.slug] = await ensureTenant(plan, tenantData);
  }

  await ensureUser({
    email: "admin@basixcrm.test",
    name: "Super Admin",
    password: "admin123",
    role: UserRole.SUPER_ADMIN,
    tenantId: tenantRecords.acme?.id,
  });

  await ensureUser({
    email: "owner@acme.test",
    name: "Owner Acme",
    password: "owner123",
    tenantId: tenantRecords.acme?.id,
  });

  await ensureUser({
    email: "owner@contoso.test",
    name: "Owner Contoso",
    password: "owner123",
    tenantId: tenantRecords.contoso?.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
