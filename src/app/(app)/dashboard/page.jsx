
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  CalendarDays,
  CalendarClock,
  GitBranch,
  Plus,
  Repeat,
} from "lucide-react";

import { requireUser } from "@/lib/session";
import { canManage, isOwner } from "@/lib/rbac";
import { getTeamStats, listVisibleUsers } from "@/lib/users";
import { computeTaskStats, listVisibleTasks } from "@/lib/tasks";
import { listVisibleMeetings, pendingDecisionsFromMeetings } from "@/lib/meetings";
import { listVisibleRecurring } from "@/lib/recurring";
import { isDueOn, dayKeyOf, todayDayKey } from "@/lib/recurring-schedule";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";

import { PendingDecisions } from "@/components/dashboard/pending-decisions";
import { RecentActivityList } from "@/components/dashboard/recent-activity-list";
import { TierBadge } from "@/components/role-badge";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { SUBTASK_STATUS_META } from "@/lib/task-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const MINI_ACCENTS = {
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

/** Compact KPI tile so every tile sits comfortably in a single row; links out when `href` is set. */
function MiniStat({ title, value, icon: Icon, accent, href }) {
  const inner = (
    <>
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md sm:size-7",
          MINI_ACCENTS[accent]
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-none tracking-tight sm:text-lg">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
          {title}
        </p>
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-2 rounded-lg border bg-card p-2 transition-colors hover:bg-accent/40 sm:p-2.5"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2 sm:p-2.5">
      {inner}
    </div>
  );
}

/** Numbered index chip for the concise dashboard lists. */
function IndexChip({ n }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
      {n}
    </span>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const manage = canManage(user.role);
  const chair = isOwner(user.role);
  const firstName = user.name.split(" ")[0] || user.name;

  // Fetch the heavy lists once; derive stats/decisions from them in-memory
  // rather than re-querying (getTaskStats and listPendingDecisions would each
  // re-run the same find()).
  const [tasks, teamStats, recentMembers, meetings, recurring] = await Promise.all([
    listVisibleTasks(user),
    manage && !chair ? getTeamStats(user) : Promise.resolve(null),
    manage && !chair
      ? listVisibleUsers(user).then((u) =>
          u.filter((x) => x.id !== user.id).slice(0, 5)
        )
      : Promise.resolve([]),
    listVisibleMeetings(user),
    listVisibleRecurring(user),
  ]);
  const taskStats = computeTaskStats(tasks, user.id);
  const pendingDecisions = pendingDecisionsFromMeetings(meetings, user.id);

  const upcomingMeetings = meetings
    .filter((m) => m.status === "scheduled")
    .slice(0, 4);

  const recurringActiveCount = recurring.filter(
    (r) => r.active && !r.paused
  ).length;

  // Recurring tasks due today, bucketed by whether a response has already been
  // logged. An assignee sees their own status; the creator/a manager (who may
  // not be an assignee themselves) sees whether the whole team has responded.
  const today = todayDayKey();
  const recurringDueToday = recurring
    .filter((r) => r.active && !r.paused)
    .filter((r) => {
      const startKey = dayKeyOf(r.startDate) || today;
      const endKey = dayKeyOf(r.endDate);
      return (!endKey || today <= endKey) && isDueOn(r.schedule, today, startKey);
    })
    .map((r) => {
      const mine = r.assignees.find((a) => a.id === user.id);
      if (mine) {
        const responded = r.entries.some(
          (e) => e.assigneeId === user.id && e.day === today
        );
        return { r, responded, scope: "you", pendingNames: [] };
      }
      const pendingNames = r.assignees
        .filter((a) => !r.entries.some((e) => e.assigneeId === a.id && e.day === today))
        .map((a) => a.name);
      return { r, responded: pendingNames.length === 0, scope: "team", pendingNames };
    });

  const recurringPending = recurringDueToday.filter((x) => !x.responded).slice(0, 6);
  const recurringResponded = recurringDueToday.filter((x) => x.responded).slice(0, 6);

  // A trimmed feed of notable, review-lifecycle activity across every task the
  // viewer can see (submissions, approvals, send-backs, reopen/cancel) — the
  // routine "attached a file" / "changed the due date" entries are left out so
  // the feed stays about what actually needs attention.
  const NOTABLE_ACTIVITY = /submitted|approved|sent .*back|reopened|cancelled/i;
  const recentActivity = tasks
    .flatMap((t) =>
      (t.activity || [])
        .filter((a) => NOTABLE_ACTIVITY.test(a.message))
        .map((a) => ({ ...a, taskKeyRef: t.key, taskTitle: t.title }))
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20);

  // Tasks this viewer created — shown on every dashboard regardless of role,
  // distinct from "my tasks" (assigned to me) and, for the Admin, distinct
  // from the org-wide pending list.
  const createdByMe = tasks
    .filter((t) => t.assignerId === user.id)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 6);

  const decisionsCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending meeting decisions</CardTitle>
        <CardDescription>Action points from meetings you attended</CardDescription>
      </CardHeader>
      <CardContent>
        <PendingDecisions decisions={pendingDecisions} />
      </CardContent>
    </Card>
  );

  // Work waiting on this manager to review — every manager/admin can approve
  // any task's submission (see canReviewTask/isReviewer), so this is org-wide
  // for them, not just tasks they created. Task-level submissions (per
  // assignee) and subtask-level submissions are both surfaced here since both
  // go through the same approve/send-back flow. Shown on every management
  // dashboard (Admin included) with its own empty state, same as the other
  // review-focused cards.
  const pendingApprovalTasks = manage
    ? tasks
        .flatMap((t) =>
          t.assignees
            .filter((a) => a.status === "submitted")
            .map((a) => ({ task: t, assignee: a }))
        )
        .slice(0, 6)
    : [];

  const pendingApprovalSubtasks = manage
    ? tasks
        .flatMap((t) =>
          (t.subtasks ?? [])
            .filter((s) => s.status === "submitted")
            .map((s) => ({ task: t, sub: s }))
        )
        .slice(0, 6)
    : [];

  const approvalsCount = pendingApprovalTasks.length + pendingApprovalSubtasks.length;

  const approvalsCard = manage && (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Pending your approval
          {approvalsCount > 0 && (
            <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-400">
              {approvalsCount}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Submitted work waiting on a reviewer</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/tasks?status=in_review">
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {approvalsCount === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Nothing waiting on your approval right now.
          </p>
        ) : (
          <ul className="divide-y">
            {pendingApprovalTasks.map(({ task: t, assignee: a }) => (
              <li key={`${t.id}-${a.id}`}>
                <Link
                  href={`/tasks/${t.key}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <ClipboardCheck className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.name} submitted their part for review
                    </p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </Link>
              </li>
            ))}
            {pendingApprovalSubtasks.map(({ task: t, sub: s }) => (
              <li key={s.id}>
                <Link
                  href={`/tasks/${t.key}/${s.key}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <GitBranch className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Subtask of {t.title}
                      {s.assigneeName ? ` · ${s.assigneeName} submitted` : ""}
                    </p>
                  </div>
                  <PriorityBadge priority={s.priority} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  // KPI row — shared by every dashboard. Focused on what needs attention right
  // now (active work, work waiting on a reviewer, recurring load, and anything
  // overdue) plus a quick look at what's coming up in meetings.
  const kpis = [
    {
      title: "In progress",
      value: taskStats.inProgress,
      icon: Clock,
      accent: "amber",
      href: "/tasks?status=in_progress",
    },
    {
      title: "Marked for review",
      value: taskStats.inReview,
      icon: ClipboardCheck,
      accent: "sky",
      href: "/tasks?status=in_review",
    },
    {
      title: "Recurring",
      value: recurringActiveCount,
      icon: Repeat,
      accent: "violet",
      href: "/recurring",
    },
    {
      title: "Delayed",
      value: taskStats.delayed,
      icon: AlertTriangle,
      accent: "rose",
      href: "/tasks?status=delayed",
    },
    {
      title: "Upcoming meetings",
      value: upcomingMeetings.length,
      icon: CalendarClock,
      accent: "emerald",
      href: "/meetings",
    },
  ];

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {firstName}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{user.role}</span>
          <span aria-hidden>•</span>
          <TierBadge role={user.role} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex">
          <CalendarDays className="size-4" />
          {formatDate(new Date())}
        </span>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/tasks/new">
            <Plus className="size-4" />
            New task
          </Link>
        </Button>
      </div>
    </div>
  );

  const kpiRow = (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {kpis.map((k) => (
        <MiniStat key={k.title} {...k} />
      ))}
    </div>
  );

  // "Created by you" — present on every dashboard, regardless of role.
  const createdCard = (
    <Card>
      <CardHeader>
        <CardTitle>Created by you</CardTitle>
        <CardDescription>Tasks you created, most recently updated first</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/tasks">
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {createdByMe.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t created any tasks yet.
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/tasks/new">
                <Plus className="size-4" />
                Create a task
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {createdByMe.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.key}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                      <span className="text-xs text-muted-foreground">
                        {t.assignees.length}{" "}
                        {t.assignees.length === 1 ? "person" : "people"}
                      </span>
                    </div>
                  </div>
                  {t.dueDate && (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 text-xs",
                        t.overdue
                          ? "font-medium text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="size-3.5" />
                      {formatDate(t.dueDate)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  // Upcoming meetings alongside the checkpoints (decisions) still to be closed
  // out — present on every dashboard.
  const meetingsRow = (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming meetings</CardTitle>
          <CardDescription>Scheduled sessions you can join</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="icon">
              <Link href="/meetings">
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingMeetings.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.key}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarClock className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.scheduledAt ? formatDateTime(m.scheduledAt) : "No time set"}
                        {" · "}
                        {m.joinedCount}/{m.invitedCount} joined
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {decisionsCard}
    </div>
  );

  // Recurring tasks due today — who's responded and who's still pending.
  const recurringRow = recurringDueToday.length > 0 && (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recurring — awaiting response</CardTitle>
          <CardDescription>Due today, no response logged yet</CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href="/recurring">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recurringPending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Everyone has responded for today.
            </p>
          ) : (
            <ul className="divide-y">
              {recurringPending.map(({ r, scope, pendingNames }) => (
                <li key={r.id}>
                  <Link
                    href={`/recurring/${r.key}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Repeat className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {scope === "you"
                          ? "Your response is due today"
                          : `Waiting on ${pendingNames.join(", ")}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recurring — responded</CardTitle>
          <CardDescription>Due today, already logged</CardDescription>
        </CardHeader>
        <CardContent>
          {recurringResponded.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been logged yet today.
            </p>
          ) : (
            <ul className="divide-y">
              {recurringResponded.map(({ r, scope }) => (
                <li key={r.id}>
                  <Link
                    href={`/recurring/${r.key}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {scope === "you" ? "You responded today" : "Everyone responded today"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Recently happened — submissions, approvals, send-backs and the like.
  const activityCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Latest submissions, approvals and reviews</CardDescription>
      </CardHeader>
      <CardContent>
        <RecentActivityList activity={recentActivity} />
      </CardContent>
    </Card>
  );

  // ── Admin: clean, org-wide overview ─────────────────────────────────
  if (chair) {
    const pending = tasks
      .filter((t) => ["assigned", "in_progress", "delayed"].includes(t.status))
      .sort((a, b) => {
        if (a.delayed !== b.delayed) return a.delayed ? -1 : 1;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
      })
      .slice(0, 7);

    const completed = tasks.filter((t) => t.status === "completed").slice(0, 5);

    return (
      <div className="space-y-6">
        {header}
        {kpiRow}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pending tasks across the school */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pending tasks</CardTitle>
              <CardDescription>
                Open work across the school, most urgent first
              </CardDescription>
              <CardAction>
                <Button asChild variant="outline" size="sm">
                  <Link href="/tasks">
                    View all
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Nothing pending. Everything is on track.
                </p>
              ) : (
                <ol className="divide-y">
                  {pending.map((t, i) => (
                    <li key={t.id}>
                      <Link
                        href={`/tasks/${t.key}`}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
                      >
                        <IndexChip n={i + 1} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <StatusBadge status={t.status} />
                            <PriorityBadge priority={t.priority} />
                            <span className="text-xs text-muted-foreground">
                              {t.assignees.length}{" "}
                              {t.assignees.length === 1 ? "person" : "people"}
                            </span>
                          </div>
                        </div>
                        {t.dueDate && (
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1 text-xs",
                              t.overdue
                                ? "font-medium text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="size-3.5" />
                            {formatDate(t.dueDate)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Side column: split into two sections — approvals waiting on the
              Admin, then recently completed work — instead of one card
              stretched to match the pending-tasks list's height. */}
          <div className="flex flex-col gap-6">
            {approvalsCard}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recently completed</CardTitle>
                <CardDescription>Latest closed work</CardDescription>
              </CardHeader>
              <CardContent>
                {completed.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No completed tasks yet.
                  </p>
                ) : (
                  <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {completed.map((t, i) => (
                      <li key={t.id}>
                        <Link
                          href={`/tasks/${t.key}`}
                          className="flex items-center gap-2 rounded-lg border bg-card p-2 transition-colors hover:bg-accent/40"
                        >
                          <IndexChip n={i + 1} />
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">
                            {t.title}
                          </p>
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {createdCard}
        {meetingsRow}
        {recurringRow}
        {activityCard}
      </div>
    );
  }

  // ── Everyone else: personal task view ──────────────────────────────
  const myOpen = tasks
    .map((t) => ({ task: t, mine: t.assignees.find((a) => a.id === user.id) }))
    .filter((x) => x.mine && x.mine.status !== "completed")
    .sort((a, b) => {
      if (!a.task.dueDate) return 1;
      if (!b.task.dueDate) return -1;
      return a.task.dueDate < b.task.dueDate ? -1 : 1;
    })
    .slice(0, 6);

  // Subtasks assigned directly to me (I may not be on the parent task itself),
  // earliest expected date first. Surfaced so a subtask-only assignee isn't left
  // wondering where their work is.
  const mySubtasks = tasks
    .flatMap((t) =>
      (t.subtasks ?? [])
        .filter((s) => s.assigneeId === user.id && s.status !== "done")
        .map((s) => ({ sub: s, task: t }))
    )
    .sort((a, b) => {
      if (!a.sub.expectedDate) return 1;
      if (!b.sub.expectedDate) return -1;
      return a.sub.expectedDate < b.sub.expectedDate ? -1 : 1;
    })
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {header}
      {kpiRow}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My tasks */}
        <Card className={cn(manage && teamStats ? "lg:col-span-2" : "lg:col-span-3")}>
          <CardHeader>
            <CardTitle>My tasks</CardTitle>
            <CardDescription>Open work assigned to you</CardDescription>
            <CardAction>
              <Button asChild variant="outline" size="sm">
                <Link href="/tasks">
                  View all
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {myOpen.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  You have no open tasks. Nice and clear.
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/tasks/new">
                    <Plus className="size-4" />
                    Create a task
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {myOpen.map(({ task: t, mine }) => (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.key}`}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-accent/40 -mx-2 px-2 rounded-md"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {mine && <StatusBadge status={mine.status} />}
                          <PriorityBadge priority={t.priority} />
                        </div>
                      </div>
                      {t.dueDate && (
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 text-xs",
                            t.overdue
                              ? "font-medium text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="size-3.5" />
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        {manage && teamStats && (
          <Card>
            <CardHeader>
              <CardTitle>Team overview</CardTitle>
              <CardDescription>People you oversee</CardDescription>
              <CardAction>
                <Button asChild variant="outline" size="sm">
                  <Link href="/users">
                    Manage
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xl font-semibold">{teamStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xl font-semibold">{teamStats.byTier.ADMIN}</p>
                  <p className="text-xs text-muted-foreground">Admins</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xl font-semibold">{teamStats.byTier.WORKER}</p>
                  <p className="text-xs text-muted-foreground">Workers</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Recently added
                </p>
                {recentMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No team members yet.
                    <div className="mt-2">
                      <Button asChild size="sm">
                        <Link href="/users">
                          <UserPlus className="size-4" />
                          Add member
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recentMembers.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2">
                        <Avatar className="size-8">
                          <AvatarImage src={m.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {m.role}
                          </p>
                        </div>
                        <TierBadge role={m.role} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {approvalsCard}

      {createdCard}

      {/* My subtasks — only when I have open ones assigned to me */}
      {mySubtasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My subtasks</CardTitle>
            <CardDescription>Subtask items assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {mySubtasks.map(({ sub, task: t }) => {
                const meta = SUBTASK_STATUS_META[sub.status];
                const overdue = sub.overdue;
                return (
                  <li key={sub.id}>
                    <Link
                      href={`/tasks/${t.key}/${sub.key}`}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GitBranch className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{sub.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {meta && (
                            <Badge
                              variant="outline"
                              className={cn("font-medium", meta.badgeClass)}
                            >
                              {meta.label}
                            </Badge>
                          )}
                          <PriorityBadge priority={sub.priority} />
                          <span className="truncate text-xs text-muted-foreground">
                            {t.key} · {t.title}
                          </span>
                        </div>
                      </div>
                      {sub.expectedDate && (
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 text-xs",
                            overdue
                              ? "font-medium text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="size-3.5" />
                          {formatDate(sub.expectedDate)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {meetingsRow}
      {recurringRow}
      {activityCard}
    </div>
  );
}
