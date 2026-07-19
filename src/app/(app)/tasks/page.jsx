import { requireUser } from "@/lib/session";
import { listVisibleTasks } from "@/lib/tasks";
import { TasksClient } from "@/components/tasks/tasks-client";

export const metadata = { title: "Tasks" };

const VALID_STATUSES = [
  "assigned",
  "in_progress",
  "in_review",
  "delayed",
  "draft",
  "completed",
  "cancelled",
];

export default async function TasksPage({ searchParams }) {
  const user = await requireUser();
  const tasks = await listVisibleTasks(user);
  const status = (await searchParams)?.status;

  return (
    <TasksClient
      tasks={tasks}
      currentUser={{ id: user.id, role: user.role, tier: user.tier }}
      initialStatus={VALID_STATUSES.includes(status) ? status : "all"}
    />
  );
}
