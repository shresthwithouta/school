import { requireUser } from "@/lib/session";
import { listVisibleRecurring } from "@/lib/recurring";
import { RecurringClient } from "@/components/recurring/recurring-client";

export const metadata = { title: "Recurring" };

export default async function RecurringPage() {
  const user = await requireUser();
  const recurring = await listVisibleRecurring(user);

  return (
    <RecurringClient
      recurring={recurring}
      currentUser={{ id: user.id, role: user.role, tier: user.tier }}
    />
  );
}
