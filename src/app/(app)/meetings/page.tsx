import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { canManage } from "@/lib/rbac";
import { listVisibleMeetings } from "@/lib/meetings";
import { listVisibleUsers } from "@/lib/users";

import { PageHeader } from "@/components/page-header";
import { MeetingsClient } from "@/components/meetings/meetings-client";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  const user = await requireUser();
  const [meetings, visible] = await Promise.all([
    listVisibleMeetings(user),
    listVisibleUsers(user),
  ]);
  const people = visible.map((u) => ({ id: u.id, name: u.name, role: u.role }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Schedule meetings, invite attendees, share notes and record minutes."
      />
      <MeetingsClient
        meetings={meetings}
        people={people}
        currentUser={{ id: user.id, role: user.role, tier: user.tier }}
        canManage={canManage(user.role)}
      />
    </div>
  );
}
