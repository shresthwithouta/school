import { requireUser } from "@/lib/session";
import { listVisibleTasks } from "@/lib/tasks";
import { TasksClient } from "@/components/tasks/tasks-client";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const user = await requireUser();
  const tasks = await listVisibleTasks(user);

  return (
    <TasksClient
      tasks={tasks}
      currentUser={{ id: user.id, role: user.role, tier: user.tier }}
    />
  );
}
