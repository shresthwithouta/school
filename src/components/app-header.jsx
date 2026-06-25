"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_SECTIONS } from "@/lib/nav";

function titleFromPath(pathname) {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.title;
      }
    }
  }
  const seg = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h1 className="text-base font-semibold tracking-tight">
        {titleFromPath(pathname)}
      </h1>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
