"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, CalendarClock, Settings, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Tasks", href: "/tasks", icon: ListChecks },
  { title: "Meetings", href: "/meetings", icon: CalendarClock },
  { title: "Settings", href: "/settings", icon: Settings },
];

function active(pathname, href, exact) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {TABS.slice(0, 2).map((t) => (
          <TabLink key={t.href} tab={t} pathname={pathname} />
        ))}

        <Link
          href="/tasks/new"
          aria-label="Create task"
          className="-mt-5 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
        >
          <Plus className="size-6" />
        </Link>

        {TABS.slice(2).map((t) => (
          <TabLink key={t.href} tab={t} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({ tab, pathname }) {
  const isActive = active(pathname, tab.href, tab.exact);
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <tab.icon className="size-5" />
      {tab.title}
    </Link>
  );
}
