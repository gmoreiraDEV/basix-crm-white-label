import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ReactNode } from "react";


export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full gap-6">
      <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        <section className="w-full ">{children}</section>
      </main>
      </SidebarProvider>
    </div>
  );
}