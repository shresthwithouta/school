import { requireUser } from "@/lib/session";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { MobileTabs } from "@/components/mobile-tabs";

export default async function AppLayout({
  children,
}

) {
  const user = await requireUser();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <AppHeader user={user} />
        <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6 lg:p-8">{children}</main>
        <MobileTabs role={user.role} />
      </SidebarInset>
    </SidebarProvider>
  );
}
