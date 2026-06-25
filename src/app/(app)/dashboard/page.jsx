
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
  Plus,
} from "lucide-react";

import { requireUser } from "@/lib/session";
import { canManage } from "@/lib/rbac";
import { getTeamStats, listVisibleUsers } from "@/lib/users";
import { getTaskStats, listVisibleTasks } from "@/lib/tasks";
import { listVisibleMeetings } from "@/lib/meetings";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";

import { StatCard } from "@/components/stat-card";
import { TierBadge } from "@/components/role-badge";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
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

export default async function DashboardPage() {
  const user = await requireUser();
  const manage = canManage(user.role);
  const firstName = user.name.split(" ")[0] || user.name;

  const [taskStats, tasks, teamStats, recentMembers, meetings] =
    await Promise.all([
      getTaskStats(user),
      listVisibleTasks(user),
      manage ? getTeamStats(user) : Promise.resolve(null),
      manage
        ? listVisibleUsers(user).then((u) =>
            u.filter((x) => x.id !== user.id).slice(0, 5)
          )
        : Promise.resolve([]),
      listVisibleMeetings(user),
    ]);

  const upcomingMeetings = meetings
    .filter((m) => m.status === "scheduled")
    .slice(0, 4);

  const myOpen = tasks
    .map((t) => ({ task: t, mine: t.assignees.find((a) => a.id === user.id) }))
    .filter((x) => x.mine && x.mine.status !== "completed")
    .sort((a, b) => {
      if (!a.task.dueDate) return 1;
      if (!b.task.dueDate) return -1;
      return a.task.dueDate < b.task.dueDate ? -1 : 1;
    })
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Greeting */}
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
          <Button asChild>
            <Link href="/tasks">
              <Plus className="size-4" />
              New task
            </Link>
          </Button>
        </div>
      </div>

      {/* Real task stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending"
          value={taskStats.pending}
          hint="Awaiting acceptance / start"
          icon={ClipboardList}
          accent="sky"
        />
        <StatCard
          title="In progress"
          value={taskStats.inProgress}
          hint="Currently being worked on"
          icon={Clock}
          accent="amber"
        />
        <StatCard
          title="Completed"
          value={taskStats.completed}
          hint="Approved & closed"
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          title="Overdue"
          value={taskStats.overdue}
          hint="Past their deadline"
          icon={AlertTriangle}
          accent="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>My tasks</CardTitle>
              <CardDescription>Open work assigned to you</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/tasks">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {myOpen.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  You have no open tasks. Nice and clear.
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/tasks">
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
                      href="/tasks"
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-accent/40 -mx-2 px-2 rounded-md"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.title}</p>
                        <div className="mt-1 flex items-center gap-2">
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
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Team overview</CardTitle>
                <CardDescription>People you oversee</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/users">
                  Manage
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
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
                <Link href="/profile">
                  Edit profile
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming meetings */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Upcoming meetings</CardTitle>
            <CardDescription>Scheduled meetings you can join</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/meetings">
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
          ) : (
            <ul className="divide-y">
              {upcomingMeetings.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
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
    </div>
  );
}
