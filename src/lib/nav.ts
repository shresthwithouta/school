import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  CalendarClock,
  PartyPopper,
  Users,
  BarChart3,
  CheckCheck,
  UserCircle,
  Settings,
} from "lucide-react";

import { canManage, isOwner } from "@/lib/rbac";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Only Owner + Admin tiers can see this. */
  manageOnly?: boolean;
  /** Only the Owner tier can see this. */
  ownerOnly?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "My Tasks", href: "/tasks", icon: ListChecks },
      { title: "Meetings", href: "/meetings", icon: CalendarClock },
      { title: "Events", href: "/events", icon: PartyPopper },
      { title: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Team", href: "/users", icon: Users, manageOnly: true },
      { title: "Approvals", href: "/approvals", icon: CheckCheck, manageOnly: true },
      { title: "Analytics", href: "/reports", icon: BarChart3, manageOnly: true },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: UserCircle },
      { title: "Settings", href: "/settings", icon: Settings, ownerOnly: true },
    ],
  },
];

/** Filters nav sections down to what a given role is allowed to see. */
export function navForRole(role?: string | null): NavSection[] {
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
