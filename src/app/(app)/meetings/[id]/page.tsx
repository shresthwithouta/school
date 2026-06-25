import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { getMeetingForActor } from "@/lib/meetings";
import { listVisibleUsers } from "@/lib/users";
import { MeetingPageClient } from "@/components/meetings/meeting-page-client";

export const metadata: Metadata = { title: "Meeting" };

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const meeting = await getMeetingForActor(user, id);
  if (!meeting) notFound();

  const visible = await listVisibleUsers(user);
  const people = visible.map((u) => ({ id: u.id, name: u.name, role: u.role }));

  return (
    <MeetingPageClient
      meeting={meeting}
      people={people}
      currentUser={{ id: user.id, role: user.role, tier: user.tier }}
    />
  );
}
