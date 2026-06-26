
import {
  LayoutDashboard,
  ListChecks,
  CalendarClock,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
} from "lucide-react";

import { canManage } from "@/lib/rbac";

 














export const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Tasks", href: "/tasks", icon: ListChecks },
      { title: "Meetings", href: "/meetings", icon: CalendarClock },
      { title: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Team", href: "/users", icon: Users, manageOnly: true },
      { title: "Analytics", href: "/reports", icon: BarChart3, manageOnly: true },
    ],
  },
  {
    label: "Account",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
];

/** Filters nav sections down to what a given role is allowed to see. */
export function navForRole(role) {
  const manage = canManage(role);

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.manageOnly) return manage;
      return true;
    }),
  })).filter((section) => section.items.length > 0);
}
