
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getTaskForActor } from "@/lib/tasks";
import { listAssignableTaskUsers } from "@/lib/users";
import { TaskPageClient } from "@/components/tasks/task-page-client";

export const metadata = { title: "Task" };

export default async function TaskPage({
  params,
}

) {
  const user = await requireUser();
  const { id } = await params;

  const task = await getTaskForActor(user, id);
  if (!task) notFound();

  const visible = await listAssignableTaskUsers(user);
  const assignees = visible.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
  }));

  return (
    <TaskPageClient
      task={task}
      assignees={assignees}
      currentUser={{ id: user.id, role: user.role, tier: user.tier }}
    />
  );
}
