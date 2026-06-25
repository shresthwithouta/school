

import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Build event teams, assign tasks, manage budgets and submit final event reports."
      />
      <ComingSoon
        feature="Event management"
        note="Cultural, Logistics, Hospitality, Finance, Publicity and Discipline teams will live here."
      />
    </div>
  );
}
