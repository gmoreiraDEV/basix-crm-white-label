import Link from "next/link";

import { getAuthContextFromCookies } from "@/lib/auth-context";
import { enabledPluginsSet } from "@/lib/feature-pages";
import { navItems, superAdminNav } from "@/lib/features";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";

export async function AppSidebar() {
  const auth = await getAuthContextFromCookies();
  const enabled = enabledPluginsSet(auth);
  const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";
  const visible = navItems.filter((item) => enabled.has(item.featureKey));

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="font-semibold mb-1">{auth?.tenant?.name ?? "Dashboard"}</div>
        <p className="text-xs text-gray-500">
          Plano: {auth?.tenant?.subscriptionPlan.name ?? "-"}
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 hover:bg-gray-100 text-sm"
            >
              {item.label}
            </Link>
          ))}
          {isSuperAdmin && (
            <Link
              href={superAdminNav.href}
              className="mt-2 block rounded-lg px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              {superAdminNav.label}
            </Link>
          )}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
