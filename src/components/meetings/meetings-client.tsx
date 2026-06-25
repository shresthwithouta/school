"use client";

import Link from "next/link";
import { CalendarClock, Plus, Users, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import type { AssignableUser } from "@/components/tasks/user-combobox";
import { cn, formatDateTime } from "@/lib/utils";
import type { MeetingDTO } from "@/lib/meetings";

export function MeetingsClient({
  meetings,
  people,
  currentUser,
  canManage,
}: {
  meetings: MeetingDTO[];
  people: AssignableUser[];
  currentUser: { id: string; role: string; tier: string };
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <MeetingDialog
            mode="create"
            people={people}
            currentUserId={currentUser.id}
            trigger={
              <Button>
                <Plus className="size-4" />
                New meeting
              </Button>
            }
          />
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">No meetings yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {canManage
              ? "Schedule your first meeting and invite your team."
              : "You'll see meetings here once you're invited."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        m.status === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
                      )}
                    >
                      {m.status === "completed" ? "Completed" : "Scheduled"}
                    </Badge>
                  </div>
                  <h3 className="mt-2 truncate font-medium">{m.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    by {m.createdByName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    {m.scheduledAt ? formatDateTime(m.scheduledAt) : "No time set"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {m.joinedCount}/{m.invitedCount} joined
                    {m.maxAttendees ? ` · max ${m.maxAttendees}` : ""}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
