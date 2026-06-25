

import { requireManager } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requireManager();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review submitted work and approve or send it back with feedback."
      />
      <ComingSoon feature="Workflow approvals" />
    </div>
  );
}
