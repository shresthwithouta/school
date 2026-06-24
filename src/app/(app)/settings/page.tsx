import type { Metadata } from "next";

import { requireOwner } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireOwner();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="School-wide configuration, departments and policies."
      />
      <ComingSoon feature="Organization settings" />
    </div>
  );
}
