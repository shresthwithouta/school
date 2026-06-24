import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="A unified view of deadlines, meetings and events."
      />
      <ComingSoon feature="Calendar" />
    </div>
  );
}
