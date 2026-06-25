
import { ClipboardList, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

import { requireUser } from "@/lib/session";
import { listVisibleUsers } from "@/lib/users";
import { getTaskStats, listVisibleTasks } from "@/lib/tasks";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TasksClient } from "@/components/tasks/tasks-client";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const user = await requireUser();
  const [tasks, stats, visibleUsers] = await Promise.all([
    listVisibleTasks(user),
    getTaskStats(user),
    listVisibleUsers(user),
  ]);

  const assignees = visibleUsers.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Create, assign, track and approve work across your team."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending" value={stats.pending} icon={ClipboardList} accent="sky" />
        <StatCard title="In progress" value={stats.inProgress} icon={Clock} accent="amber" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} accent="emerald" />
        <StatCard title="Overdue" value={stats.overdue} icon={AlertTriangle} accent="rose" />
      </div>

      <TasksClient
        tasks={tasks}
        assignees={assignees}
        currentUser={{ id: user.id, role: user.role, tier: user.tier }}
      />
    </div>
  );
}
