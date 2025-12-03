import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { JWTPayload, verifyToken } from "@/lib/jwt";
import { Tenant, TenantRole, User } from "@prisma/client";

type TenantWithRelations = Tenant & {
  subscriptionPlan: {
    id: string;
    name: string;
    slug: string;
    plugins: { pluginId: string; plugin: { id: string; key: string; name: string } }[];
  };
  pluginToggles: { pluginId: string; enabled: boolean; plugin: { id: string; key: string } }[];
};

export type AuthContext = {
  user: User & { memberships: { tenantId: string; role: TenantRole }[] };
  tenant: TenantWithRelations | null;
  enabledPlugins: string[];
  planPlugins: string[];
};

async function getCookieToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value ?? null;
}

export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = (req as any).headers?.get?.("cookie") as string | null;
  const cookie = (req as any).cookies?.get?.("token")?.value ?? null;
  if (cookie) return cookie;
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split("; ")
    .find((entry) => entry.startsWith("token="));
  return raw ? raw.split("=")[1] : null;
}

export async function buildAuthContext(token: string | null): Promise<AuthContext | null> {
  const payload: JWTPayload | null = token ? verifyToken(token) : null;
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { memberships: true },
  });
  if (!user) return null;

  const tenantId = payload.tenantId || user.defaultTenantId || user.memberships[0]?.tenantId;
  if (!tenantId) {
    return { user, tenant: null, enabledPlugins: [], planPlugins: [] };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptionPlan: { include: { plugins: { include: { plugin: true } } } },
      pluginToggles: { include: { plugin: true } },
    },
  });

  const planPlugins = tenant?.subscriptionPlan.plugins.map((p) => p.plugin.key) ?? [];
  const toggles = new Map(
    (tenant?.pluginToggles ?? []).map((toggle) => [toggle.plugin.key, toggle.enabled])
  );
  const enabledPlugins = planPlugins.filter((key) => toggles.get(key) ?? true);

  return { user, tenant, enabledPlugins, planPlugins };
}

export async function getAuthContextFromCookies() {
  const token = await getCookieToken();
  return buildAuthContext(token);
}
