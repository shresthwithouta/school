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

  return (
    <SubtaskPageClient
      task={{ id: task.id, key: task.key, title: task.title }}
      sub={sub}
      assignees={assignees}
      canEdit={user.id === task.assignerId}
      currentUserId={user.id}
    />
  );
}
