import {
  LayoutDashboard,
  ListChecks,
  CalendarClock,
  Users,
  BarChart3,
  UserCircle,
} from "lucide-react";

import { canManage, isOwner } from "@/lib/rbac";

export const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "My Tasks", href: "/tasks", icon: ListChecks },
      { title: "Meetings", href: "/meetings", icon: CalendarClock },
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
    items: [{ title: "Profile", href: "/profile", icon: UserCircle }],
  },
];

/** Filters nav sections down to what a given role is allowed to see. */
export function navForRole(role) {
  const manage = canManage(role);
  const owner = isOwner(role);

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.ownerOnly) return owner;
      if (item.manageOnly) return manage;
      return true;
    }),
  })).filter((section) => section.items.length > 0);
}
