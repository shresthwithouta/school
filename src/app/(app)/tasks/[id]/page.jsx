import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getTaskForActor, resetMockTask } from "@/lib/tasks";
import { listAssignableTaskUsers } from "@/lib/users";
import { TaskPageClient } from "@/components/tasks/task-page-client";

export const metadata = { title: "Task" };

export default async function TaskPage({
  params,
  searchParams,
}) {
  const user = await requireUser();
  const { id } = await params;
  const sParams = await searchParams;

  // Consume the reset flag once, then redirect to the clean URL so that
  // subsequent router.refresh() calls don't keep resetting the mock task.
  if (sParams?.reset === "true") {
    resetMockTask();
    redirect(`/tasks/${id}`);
  }

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
