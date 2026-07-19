"use client";

import Link from "next/link";
import { CalendarClock, Plus, Users, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";

import { cn, formatDateTime } from "@/lib/utils";


export function MeetingsClient({
  meetings,
  people,
  currentUser,
  canManage,
}




) {
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
              href={`/meetings/${m.key}`}
              className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                  <h3 className="mt-2 wrap-break-word font-medium">{m.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    by {m.createdByName}
                  </p>
                </div>
                <div className="flex flex-row flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:shrink-0 sm:flex-col sm:items-end sm:gap-2">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <CalendarClock className="size-3.5" />
                    {m.scheduledAt ? formatDateTime(m.scheduledAt) : "No time set"}
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
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
