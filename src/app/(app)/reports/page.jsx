import Link from "next/link";
import { ClipboardList, CheckCircle2, AlertTriangle, CircleDashed, TrendingUp, ChevronRight } from "lucide-react";

import { requireManager } from "@/lib/session";
import { getTaskAnalytics } from "@/lib/tasks";
import { getInitials } from "@/lib/utils";

import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Assigned" value={a.totalAssigned} icon={ClipboardList} accent="sky" />
        <StatCard
          title="Completed"
          value={a.completedTasks}
          hint={`${a.completionRate}% completion rate`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard title="Delayed" value={a.delayedTasks} icon={AlertTriangle} accent="rose" />
        <StatCard title="On track" value={a.onTrack} icon={CircleDashed} accent="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            Per-person performance
          </CardTitle>
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
                    <TableHead className="text-right">Delayed</TableHead>
                    <TableHead className="text-right">On track</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.perUser.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link
                          href={`/reports/${u.id}`}
                          className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-accent/40"
                        >
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-xs text-primary">
                              {getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{u.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.role}</p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{u.assigned}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span>
                            {u.completed}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({u.completionRate}%)
                            </span>
                          </span>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${u.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {u.delayed > 0 ? (
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {u.delayed}
                          </span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="text-right">{u.onTrack}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
