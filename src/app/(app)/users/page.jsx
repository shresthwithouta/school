
import { Users, Shield, UserCheck, UserX } from "lucide-react";

import { requireManager } from "@/lib/session";
import { getTeamStats, listVisibleUsers } from "@/lib/users";

import { StatCard } from "@/components/stat-card";
import { UsersManager } from "@/components/users/users-manager";

export const metadata = { title: "Team" };

export default async function UsersPage() {
  const actor = await requireManager();
  const [users, stats] = await Promise.all([
    listVisibleUsers(actor),
    getTeamStats(actor),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard title="Total members" value={stats.total} icon={Users} />
        <StatCard
          title="Admins"
          value={stats.byTier.OWNER}
          icon={Shield}
          accent="primary"
        />
        <StatCard
          title="Managers"
          value={stats.byTier.ADMIN}
          icon={Shield}
          accent="primary"
        />
        <StatCard
          title="Teachers & Staff"
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
