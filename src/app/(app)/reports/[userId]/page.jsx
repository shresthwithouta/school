import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Building2, CalendarDays } from "lucide-react";

import { requireManager } from "@/lib/session";
import { listVisibleTasks } from "@/lib/tasks";
import { getUserByIdForActor } from "@/lib/users";
import { formatDate, getInitials } from "@/lib/utils";

import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { TierBadge, RoleBadge } from "@/components/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Member analytics" };

function Stat({ label, value, danger }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className={`text-xl font-semibold ${danger && value > 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function MemberAnalyticsPage({ params }) {
  const actor = await requireManager();
  const { userId } = await params;

  const user = await getUserByIdForActor(actor, userId);
  if (!user) notFound();

  const tasks = (await listVisibleTasks(actor))
    .filter((t) => t.assignees.some((a) => a.id === userId))
    .filter((t) => t.status !== "draft" && t.status !== "cancelled");

  const minePart = (t) => t.assignees.find((a) => a.id === userId);
  const completed = tasks.filter((t) => minePart(t)?.status === "completed").length;
  const delayed = tasks.filter((t) => t.delayed && minePart(t)?.status !== "completed").length;
  // Clean partition: assigned = completed + delayed + onTrack (no overlap).
  const onTrack = Math.max(0, tasks.length - completed - delayed);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/reports">
          <ArrowLeft className="size-4" />
          Back to analytics
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{user.name}</h2>
              <TierBadge role={user.role} />
              <RoleBadge role={user.role} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4" /> {user.email}
              </span>
              {user.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-4" /> {user.phone}
                </span>
              )}
              {user.department && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" /> {user.department}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" /> Joined {formatDate(user.createdAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Assigned" value={tasks.length} />
        <Stat label="Completed" value={completed} />
        <Stat label="Delayed" value={delayed} danger />
        <Stat label="On track" value={onTrack} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned.</p>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => {
                const part = minePart(t);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.key}`}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
                    >
                      <span className="hidden w-20 shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                        {t.key}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={t.status} />
                          <PriorityBadge priority={t.priority} />
                          {part && part.status === "completed" && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              their part done
                            </span>
                          )}
                          {t.delayed && t.daysLate > 0 && (
                            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                              {t.daysLate}d late
                            </span>
                          )}
                        </div>
                      </div>
                      {t.dueDate && (
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
