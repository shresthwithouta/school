"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, CalendarDays, Inbox, ArrowDownUp, ArrowUp, ArrowDown, ChevronRight } from "lucide-react";

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
import { TASK_STATUSES, STATUS_META, TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import { cn, formatDate, getInitials, toPlainText } from "@/lib/utils";

function AssigneeStack({ task }) {
  if (task.assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  const shown = task.assignees.slice(0, 3);
  const extra = task.assignees.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((a) => (
        <Avatar key={a.id} className="size-7 ring-2 ring-card" title={a.name}>
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

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "My tasks" },
  { value: "created", label: "Created by me" },
  { value: "done-by-me", label: "Completed by me" },
  { value: "drafts", label: "Drafts" },
];

const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "title", label: "Title" },
  { value: "key", label: "Key" },
];

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER = {
  delayed: 0,
  in_progress: 1,
  assigned: 2,
  draft: 3,
  completed: 4,
  cancelled: 5,
};

// Returns a comparator for the chosen field in ascending order.
// Tasks with no due date always sort to the end.
function compareBy(field) {
  return (a, b) => {
    switch (field) {
      case "created":
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      case "due": {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      case "priority":
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      case "status":
        return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      case "title":
        return a.title.localeCompare(b.title);
      case "key":
        return a.key.localeCompare(b.key, undefined, { numeric: true });
      case "updated":
      default:
        return (a.updatedAt || "").localeCompare(b.updatedAt || "");
    }
  };
}

export function TasksClient({ tasks, currentUser }) {
  // Chairman/Director (Owner tier) are never assignees, so the personal
  // "My tasks" / "Completed by me" scopes are always empty for them — hide them.
  const isChair = currentUser.tier === "OWNER";
  const scopes = isChair
    ? SCOPES.filter((s) => s.value !== "mine" && s.value !== "done-by-me")
    : SCOPES;

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("updated");
  // Time/priority-style sorts feel natural newest/most-urgent first.
  const [dir, setDir] = useState("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = tasks.filter((t) => {
      const mine = t.assignees.find((a) => a.id === currentUser.id);
      if (scope === "mine" && !mine) return false;
      if (scope === "created" && t.assignerId !== currentUser.id) return false;
      if (scope === "done-by-me" && !(mine && mine.status === "completed")) return false;
      if (scope === "drafts" && t.status !== "draft") return false;
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (
        q &&
        ![t.key, t.title, toPlainText(t.description), t.assignerName, ...t.assignees.map((a) => a.name)]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      )
        return false;
      return true;
    });

    const cmp = compareBy(sort);
    const factor = dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const base = cmp(a, b);
      // Keep null due dates last regardless of direction.
      if (sort === "due" && base !== 0 && (!a.dueDate || !b.dueDate)) return base;
      return base * factor;
    });
  }, [tasks, query, scope, status, priority, sort, dir, currentUser.id]);

  return (
    <div className="space-y-4">
      {/* Top row: scope + create */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={scope} onValueChange={setScope}>
          <TabsList className="flex-wrap">
            {scopes.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button asChild className="shrink-0">
          <Link href="/tasks/new">
            <Plus className="size-4" />
            Create
          </Link>
        </Button>
      </div>

      {/* Filter + sort row */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by key, title or person…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Status" />
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

          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full sm:w-40">
              <ArrowDownUp className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            title={dir === "asc" ? "Ascending" : "Descending"}
            onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {dir === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
      </p>

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">No tasks here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {tasks.length === 0
              ? "Create your first task to get going."
              : "Try a different filter or search."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {/* Column header (desktop) */}
          <div className="hidden items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground md:flex">
            <span className="w-20 shrink-0">Key</span>
            <span className="flex-1">Task</span>
            <span className="w-28 shrink-0">Due</span>
            <span className="w-20 shrink-0 text-right">People</span>
          </div>
          <ul className="divide-y">
            {filtered.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.key}`}
                  className="group/row flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/60 sm:px-4"
                >
                  <span className="hidden w-20 shrink-0 font-mono text-xs font-medium text-muted-foreground md:inline">
                    {t.key}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground md:hidden">
                        {t.key}
                      </span>
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                      {t.delayed && t.daysLate > 0 && (
                        <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                          {t.daysLate}d late
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "hidden w-28 shrink-0 items-center gap-1 text-xs md:inline-flex",
                      t.delayed
                        ? "font-medium text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {t.dueDate && (
                      <>
                        <CalendarDays className="size-3.5" />
                        {formatDate(t.dueDate)}
                      </>
                    )}
                  </span>
                  <div className="flex w-20 shrink-0 justify-end">
                    <AssigneeStack task={t} />
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover/row:translate-x-0.5 group-hover/row:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
