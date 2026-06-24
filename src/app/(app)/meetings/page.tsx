import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Schedule meetings, record attendance, upload minutes and assign action items."
      />
      <ComingSoon feature="Meeting management" />
    </div>
  );
}
