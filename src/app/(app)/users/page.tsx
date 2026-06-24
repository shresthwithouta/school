import type { Metadata } from "next";
import { Users, Shield, UserCheck, UserX } from "lucide-react";

import { requireManager } from "@/lib/session";
import { getTeamStats, listVisibleUsers } from "@/lib/users";
import { isOwner } from "@/lib/rbac";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { UsersManager } from "@/components/users/users-manager";

export const metadata: Metadata = { title: "Team" };

export default async function UsersPage() {
  const actor = await requireManager();
  const [users, stats] = await Promise.all([
    listVisibleUsers(actor),
    getTeamStats(actor),
  ]);

  const description = isOwner(actor.role)
    ? "Create and manage every account across the school."
    : "Create and manage worker accounts in your area.";

  return (
    <div className="space-y-6">
      <PageHeader title="Team management" description={description} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total members" value={stats.total} icon={Users} />
        <StatCard
          title="Admins"
          value={stats.byTier.ADMIN}
          icon={Shield}
          accent="primary"
        />
        <StatCard
          title="Workers"
          value={stats.byTier.WORKER}
          icon={UserCheck}
          accent="emerald"
        />
        <StatCard
          title="Inactive"
          value={stats.inactive}
          icon={UserX}
          accent="rose"
        />
      </div>

      <UsersManager
        users={users}
        actorId={actor.id}
        actorRole={actor.role}
      />
    </div>
  );
}
