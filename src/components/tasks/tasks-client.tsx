"use client";

import { useMemo, useState } from "react";
import { Search, Plus, CalendarDays, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { TaskDialog, type AssignableUser } from "@/components/tasks/task-dialog";
import { TaskDetail } from "@/components/tasks/task-detail";
import { TASK_STATUSES, STATUS_META } from "@/lib/task-meta";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { TaskDTO } from "@/lib/tasks";

type CurrentUser = { id: string; role: string; tier: string };

function AssigneeStack({ task }: { task: TaskDTO }) {
  const shown = task.assignees.slice(0, 3);
  const extra = task.assignees.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((a) => (
        <Avatar key={a.id} className="size-7 ring-2 ring-card">
          <AvatarFallback className="bg-primary/10 text-xs text-primary">
            {getInitials(a.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}

export function TasksClient({
  tasks,
  assignees,
  currentUser,
}: {
  tasks: TaskDTO[];
  assignees: AssignableUser[];
  currentUser: CurrentUser;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "mine" | "assigned">("all");
  const [status, setStatus] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (scope === "mine" && !t.assignees.some((a) => a.id === currentUser.id))
        return false;
      if (scope === "assigned" && t.assignerId !== currentUser.id) return false;
      if (status !== "all" && t.status !== status) return false;
      if (
        q &&
        ![t.title, t.description, t.assignerName, ...t.assignees.map((a) => a.name)]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [tasks, query, scope, status, currentUser.id]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="-mx-1 overflow-x-auto px-1">
          <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mine">To me</TabsTrigger>
              <TabsTrigger value="assigned">By me</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="flex-1 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TaskDialog
              mode="create"
              assignees={assignees}
              currentUserId={currentUser.id}
              trigger={
                <Button className="shrink-0">
                  <Plus className="size-4" />
                  New task
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">No tasks here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {tasks.length === 0
              ? "Create your first task to get the workflow going."
              : "Try a different filter or search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <h3 className="mt-2 truncate font-medium">{t.title}</h3>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <AssigneeStack task={t} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${t.progress}%` }}
                  />
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
              </div>
            </button>
          ))}
        </div>
      )}

      <TaskDetail
        task={selected}
        open={!!selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
        currentUser={currentUser}
        assignees={assignees}
      />
    </div>
  );
}
