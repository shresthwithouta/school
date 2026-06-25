import { requireOwner } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireOwner();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organisation-wide settings for the platform."
      />
      <ComingSoon feature="Settings" />
    </div>
  );
}
