import { requireUser } from "@/lib/session";
import { listAssignableTaskUsers } from "@/lib/users";
import { TaskCreateForm } from "@/components/tasks/task-create-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage() {
  const user = await requireUser();
  const assignableUsers = await listAssignableTaskUsers(user);
  const assignees = assignableUsers.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
  }));

  return <TaskCreateForm assignees={assignees} currentUserId={user.id} />;
}
