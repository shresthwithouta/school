import { requireUser } from "@/lib/session";
import { listAssignableTaskUsers } from "@/lib/users";
import { RecurringCreateForm } from "@/components/recurring/recurring-create-form";

export const metadata = { title: "New recurring task" };

export default async function NewRecurringPage() {
  const user = await requireUser();
  const assignableUsers = await listAssignableTaskUsers(user);
  const assignees = assignableUsers.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
  }));

  return <RecurringCreateForm assignees={assignees} currentUserId={user.id} />;
}
