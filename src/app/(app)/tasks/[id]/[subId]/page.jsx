import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getTaskForActor } from "@/lib/tasks";
import { listAssignableTaskUsers } from "@/lib/users";
import { SubtaskPageClient } from "@/components/tasks/subtask-page-client";

export const metadata = { title: "Subtask" };

export default async function SubtaskPage({ params }) {
  const user = await requireUser();
  const { id, subId } = await params;

  const task = await getTaskForActor(user, id);
  if (!task) notFound();

  const sub = task.subtasks.find((s) => s.key === subId || s.id === subId);
  if (!sub) notFound();

  const visible = await listAssignableTaskUsers(user);
  const assignees = visible.map((u) => ({ id: u.id, name: u.name, role: u.role }));

  // Anyone involved in the task (creator, an assignee, or a manager) may edit
  // subtask details and assign them; only the creator may delete a subtask.
  const isManager = user.tier === "OWNER" || user.tier === "ADMIN";
  const involved =
    user.id === task.assignerId ||
    task.assignees.some((a) => a.id === user.id) ||
    isManager;

  return (
    <SubtaskPageClient
      task={{ id: task.id, key: task.key, title: task.title }}
      sub={sub}
      assignees={assignees}
      canEdit={involved}
      canDelete={user.id === task.assignerId}
      currentUserId={user.id}
    />
  );
}
