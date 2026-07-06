import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getRecurringForActor } from "@/lib/recurring";
import { listAssignableTaskUsers } from "@/lib/users";
import { RecurringDetailClient } from "@/components/recurring/recurring-detail-client";

export const metadata = { title: "Recurring task" };

export default async function RecurringDetailPage({ params }) {
  const user = await requireUser();
  const { id } = await params;

  const recurring = await getRecurringForActor(user, id);
  if (!recurring) notFound();

  // Only the creator/managers need the assignee picker (for editing).
  const assignees = recurring.canEdit
    ? (await listAssignableTaskUsers(user)).map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
      }))
    : [];

  return (
    <RecurringDetailClient
      recurring={recurring}
      assignees={assignees}
      currentUser={{ id: user.id, role: user.role, tier: user.tier }}
    />
  );
}
