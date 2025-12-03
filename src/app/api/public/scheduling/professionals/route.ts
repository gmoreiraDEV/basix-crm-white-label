import { NextResponse } from "next/server";

import { authenticateApiKeyRequest } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { tenantPluginEnabled } from "@/lib/plugins";

export async function GET(req: Request) {
  const auth = await authenticateApiKeyRequest(req, ["scheduling:professionals:read"]);
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const pluginEnabled = await tenantPluginEnabled(auth.apiKey.tenantId, "scheduling");
  if (!pluginEnabled) {
    return NextResponse.json({ error: "Plugin de agendamento desativado" }, { status: 403 });
  }

  const professionals = await prisma.professional.findMany({
    where: { tenantId: auth.apiKey.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, title: true },
  });

  return NextResponse.json(professionals);
}
