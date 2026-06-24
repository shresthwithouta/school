import type { Metadata } from "next";

import { requireManager } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireManager();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Employee, department, event, productivity and compliance reports."
      />
      <ComingSoon
        feature="Reporting & analytics"
        note="Performance is evaluated on timeliness, quality and accuracy, with dashboards generated automatically."
      />
    </div>
  );
}
