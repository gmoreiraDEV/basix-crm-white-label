import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";

function forbid() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth || auth.user.role !== "SUPER_ADMIN") return forbid();

  const tenants = await prisma.tenant.findMany({
    include: {
      subscriptionPlan: { include: { plugins: { include: { plugin: true } } } },
      pluginToggles: { include: { plugin: true } },
    },
  });

  const payload = tenants.map((tenant) => {
    const toggles = new Map(tenant.pluginToggles.map((toggle) => [toggle.plugin.key, toggle.enabled]));
    return {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.subscriptionPlan.name,
      planSlug: tenant.subscriptionPlan.slug,
      plugins: tenant.subscriptionPlan.plugins.map((link) => ({
        key: link.plugin.key,
        name: link.plugin.name,
        enabled: toggles.get(link.plugin.key) ?? true,
      })),
    };
  });

  return NextResponse.json(payload);
}

export async function PATCH(req: Request) {
  const auth = await buildAuthContext(getTokenFromRequest(req));
  if (!auth || auth.user.role !== "SUPER_ADMIN") return forbid();

  const { tenantId, pluginKey, enabled } = await req.json();
  if (!tenantId || !pluginKey || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptionPlan: { include: { plugins: { include: { plugin: true } } } },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });

  const allowedPlugin = tenant.subscriptionPlan.plugins.find((link) => link.plugin.key === pluginKey);
  if (!allowedPlugin) {
    return NextResponse.json({ error: "Plugin não faz parte do plano do tenant" }, { status: 400 });
  }

  await prisma.tenantPlugin.upsert({
    where: { tenantId_pluginId: { tenantId, pluginId: allowedPlugin.pluginId } },
    create: {
      tenantId,
      pluginId: allowedPlugin.pluginId,
      enabled,
      enabledById: auth.user.id,
    },
    update: { enabled, enabledById: auth.user.id, enabledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
