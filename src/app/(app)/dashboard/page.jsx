
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  CalendarDays,
  CalendarClock,
  GitBranch,
  Plus,
} from "lucide-react";

import { requireUser } from "@/lib/session";
import { canManage, isOwner } from "@/lib/rbac";
import { getTeamStats, listVisibleUsers } from "@/lib/users";
import { computeTaskStats, listVisibleTasks } from "@/lib/tasks";
import { listVisibleMeetings, pendingDecisionsFromMeetings } from "@/lib/meetings";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";

import { PendingDecisions } from "@/components/dashboard/pending-decisions";
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
};

/** Compact KPI tile so all four sit comfortably in a single row. */
function MiniStat({ title, value, icon: Icon, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          MINI_ACCENTS[accent]
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none tracking-tight">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{title}</p>
      </div>
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
  const [tasks, teamStats, recentMembers, meetings] = await Promise.all([
    listVisibleTasks(user),
    manage && !chair ? getTeamStats(user) : Promise.resolve(null),
    manage && !chair
      ? listVisibleUsers(user).then((u) =>
          u.filter((x) => x.id !== user.id).slice(0, 5)
        )
      : Promise.resolve([]),
    listVisibleMeetings(user),
  ]);
  const taskStats = computeTaskStats(tasks, user.id);
  const pendingDecisions = pendingDecisionsFromMeetings(meetings, user.id);

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

  const upcomingMeetings = meetings
    .filter((m) => m.status === "scheduled")
    .slice(0, 4);

  // KPI row — shared by every dashboard.
  const kpis = [
    { title: "Pending", value: taskStats.pending, icon: ClipboardList, accent: "sky" },
    { title: "In progress", value: taskStats.inProgress, icon: Clock, accent: "amber" },
    { title: "Completed", value: taskStats.completed, icon: CheckCircle2, accent: "emerald" },
    { title: "Delayed", value: taskStats.delayed, icon: AlertTriangle, accent: "rose" },
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

  // ── Chairman / Director: clean, org-wide overview ──────────────────
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

        {/* Compact KPIs — single row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <MiniStat key={k.title} {...k} />
          ))}
        </div>

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

          {/* Side column: meetings + recently completed */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming meetings</CardTitle>
                <CardDescription>Scheduled sessions</CardDescription>
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
                  <p className="text-sm text-muted-foreground">
                    No upcoming meetings.
                  </p>
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
                            <p className="truncate text-sm font-medium">
                              {m.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.scheduledAt
                                ? formatDateTime(m.scheduledAt)
                                : "No time set"}
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
                <CardTitle className="text-base">Recently completed</CardTitle>
                <CardDescription>Latest closed work</CardDescription>
              </CardHeader>
              <CardContent>
                {completed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No completed tasks yet.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {completed.map((t, i) => (
                      <li key={t.id}>
                        <Link
                          href={`/tasks/${t.key}`}
                          className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/40"
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

        {decisionsCard}
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

      {/* Real task stats — compact 2×2 on phones, a single row on wide screens
          (same layout as the Chairman view, so the dashboards stay symmetric). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <MiniStat key={k.title} {...k} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My tasks */}
        <Card className="lg:col-span-2">
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
        {manage && teamStats ? (
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your workspace</CardTitle>
              <CardDescription>Quick access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="size-10">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings">
                  Edit profile
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* Upcoming meetings */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming meetings</CardTitle>
          <CardDescription>Scheduled meetings you can join</CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href="/meetings">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
          ) : (
            <ul className="divide-y">
              {upcomingMeetings.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.key}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarClock className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.title}</p>
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
}
