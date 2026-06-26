import { requireUser } from "@/lib/session";
import { listVisibleTasks } from "@/lib/tasks";
import { listVisibleMeetings } from "@/lib/meetings";

import { CalendarClient } from "@/components/calendar/calendar-client";

export const metadata = { title: "Calendar" };

// Flatten meetings, tasks and (my) subtasks into a single plain event list.
// Each event carries a `mine` flag — true when it's assigned to / created by
// the current user — so the client can default to "my schedule" and still let
// managers flip to everything they can see. Clicking any event opens its page
// via `href`. Items without a date simply don't appear. Kept out of the
// component body so the `Date.now()` call stays in a plain function.
function buildEvents(user, tasks, meetings) {
  const now = Date.now();
  const events = [];

  for (const m of meetings) {
    if (!m.scheduledAt) continue;
    events.push({
      id: `meeting-${m.id}`,
      type: "meeting",
      title: m.title,
      date: m.scheduledAt,
      href: `/meetings/${m.key}`,
      mine:
        m.createdById === user.id ||
        (m.attendees ?? []).some((a) => a.id === user.id),
    });
  }

  for (const t of tasks) {
    if (t.dueDate && !t.isDraft) {
      events.push({
        id: `task-${t.id}`,
        type: "task",
        title: t.title,
        date: t.dueDate,
        href: `/tasks/${t.key}`,
        overdue: t.delayed,
        done: t.status === "completed",
        mine:
          t.assignerId === user.id ||
          (t.assignees ?? []).some((a) => a.id === user.id),
      });
    }

    // Subtasks assigned to me, surfaced individually so a worker sees exactly
    // what they personally need to finish and by when.
    for (const s of t.subtasks ?? []) {
      if (!s.expectedDate || s.assigneeId !== user.id) continue;
      const done = s.status === "done";
      events.push({
        id: `subtask-${t.id}-${s.id}`,
        type: "subtask",
        title: s.title,
        subtitle: t.title,
        date: s.expectedDate,
        href: `/tasks/${t.key}/${s.key}`,
        done,
        overdue: !done && new Date(s.expectedDate).getTime() < now,
        mine: true,
      });
    }
  }

  return events;
}

export default async function CalendarPage() {
  const user = await requireUser();
  const [tasks, meetings] = await Promise.all([
    listVisibleTasks(user),
    listVisibleMeetings(user),
  ]);

  const events = buildEvents(user, tasks, meetings);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Your meetings and the tasks you need to finish, by date.
        </p>
      </div>
      <CalendarClient events={events} />
    </div>
  );
}
