import { requireOwner } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireOwner();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Appearance and account." />
      <SettingsClient
        user={{ name: user.name, email: user.email, role: user.role }}
      />
    </div>
  );
}
