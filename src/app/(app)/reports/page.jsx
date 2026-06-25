
import {
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  Timer,
  AlertTriangle,
  Star,
} from "lucide-react";

import { requireManager } from "@/lib/session";
import { getTaskAnalytics } from "@/lib/tasks";
import { formatHours, getInitials } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Analytics" };

export default async function ReportsPage() {
  const actor = await requireManager();
  const a = await getTaskAnalytics(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Task throughput and completion performance across your team."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total tasks" value={a.totalTasks} icon={ClipboardList} />
        <StatCard
          title="Completed"
          value={a.completedTasks}
          hint={`${a.completionRate}% completion rate`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          title="Avg. time to complete"
          value={formatHours(a.avgCompletionHours)}
          hint="From accept to approval"
          icon={Timer}
          accent="sky"
        />
        <StatCard
          title="Overdue"
          value={a.overdueTasks}
          icon={AlertTriangle}
          accent="rose"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            Per-person performance
          </CardTitle>
          <CardDescription>
            Who is completing work, how much, and how fast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {a.perUser.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No task data yet. Assign and complete some tasks to see analytics.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">In progress</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Avg. time</TableHead>
                    <TableHead className="text-right">Avg. rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.perUser.map((u) => {
                    const rate = u.assigned
                      ? Math.round((u.completed / u.assigned) * 100)
                      : 0;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                {getInitials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {u.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {u.role}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{u.assigned}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span>
                              {u.completed}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({rate}%)
                              </span>
                            </span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{u.inProgress}</TableCell>
                        <TableCell className="text-right">
                          {u.overdue > 0 ? (
                            <span className="font-medium text-rose-600 dark:text-rose-400">
                              {u.overdue}
                            </span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatHours(u.avgHours)}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.avgRating != null ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="size-3.5 fill-amber-400 text-amber-400" />
                              {u.avgRating}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
