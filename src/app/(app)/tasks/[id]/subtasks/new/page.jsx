import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getTaskForActor } from "@/lib/tasks";
import { listAssignableTaskUsers } from "@/lib/users";
import { SubtaskCreateForm } from "@/components/tasks/subtask-create-form";

export const metadata = { title: "New subtask" };

export default async function NewSubtaskPage({ params }) {
  const user = await requireUser();
  const { id } = await params;

  const task = await getTaskForActor(user, id);
  if (!task) notFound();

  // Only people on the task (creator, an assignee, or a manager) can add
  // subtasks — the API enforces this too; this just keeps others off the page.
  const isManager = user.tier === "OWNER" || user.tier === "ADMIN";
  const involved =
    user.id === task.assignerId ||
    task.assignees.some((a) => a.id === user.id) ||
    isManager;
  if (!involved) redirect(`/tasks/${task.key}`);

  const visible = await listAssignableTaskUsers(user);
  const assignees = visible.map((u) => ({ id: u.id, name: u.name, role: u.role }));

  return (
    <SubtaskCreateForm
      task={{ id: task.id, key: task.key, title: task.title }}
      assignees={assignees}
      currentUserId={user.id}
    />
  );
}
