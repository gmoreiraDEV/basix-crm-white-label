import { NextResponse } from "next/server";
import { buildAuthContext, getTokenFromRequest } from "@/lib/auth-context";

export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const auth = await buildAuthContext(token);
  if (!auth?.user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  return NextResponse.json({
    email: auth.user.email,
    role: auth.user.role,
    tenant: auth.tenant
      ? {
          id: auth.tenant.id,
          name: auth.tenant.name,
          slug: auth.tenant.slug,
          plan: auth.tenant.subscriptionPlan.name,
        }
      : null,
    enabledPlugins: auth.enabledPlugins,
    planPlugins: auth.planPlugins,
  });
}
