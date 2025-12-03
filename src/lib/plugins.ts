import { prisma } from "@/lib/db";

export async function tenantPluginEnabled(tenantId: string, pluginKey: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptionPlan: { include: { plugins: { include: { plugin: true } } } },
      pluginToggles: { include: { plugin: true } },
    },
  });

  if (!tenant) return false;

  const planPlugins = tenant.subscriptionPlan.plugins.map((p) => p.plugin.key);
  const toggles = new Map(tenant.pluginToggles.map((toggle) => [toggle.plugin.key, toggle.enabled]));

  return planPlugins.includes(pluginKey) && (toggles.get(pluginKey) ?? true);
}
