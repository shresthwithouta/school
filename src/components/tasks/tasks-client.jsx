"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  CalendarDays,
  Inbox,
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  CornerDownRight,
  ListTree,
  Users,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import { cn, formatDate, toPlainText } from "@/lib/utils";

const DAY_MS = 86_400_000;

// A subtask, reshaped to look exactly like a task so the list, filters, sorts
// and overview counts can treat it identically. Subtask statuses (todo /
// in_progress / done) map onto the task statuses, and the expected date plays
// the role of the due date so "delayed" works the same way.
function subtaskToRow(task, s) {
  const done = s.status === "done";
  const delayed =
    !done && !!s.expectedDate && new Date(s.expectedDate).getTime() < Date.now();
  const status = done
    ? "completed"
    : delayed
      ? "delayed"
      : s.status === "in_progress"
        ? "in_progress"
        : "assigned";
  const daysLate = delayed
    ? Math.max(1, Math.ceil((Date.now() - new Date(s.expectedDate).getTime()) / DAY_MS))
    : 0;
  return {
    id: `${task.id}::${s.id}`,
    isSubtask: true,
    parentKey: task.key,
    parentTitle: task.title,
    href: `/tasks/${task.key}/${s.key}`,
    key: s.key,
    title: s.title,
    description: s.description ?? "",
    priority: s.priority ?? "medium",
    status,
    delayed,
    daysLate,
    dueDate: s.expectedDate ?? null,
    assignerId: task.assignerId,
    assignerName: task.assignerName,
    assignees: s.assigneeId
      ? [
          {
            id: s.assigneeId,
            name: s.assigneeName,
            role: "",
            status: done ? "completed" : status,
          },
        ]
      : [],
    createdAt: s.createdAt,
    updatedAt: s.completedAt || s.createdAt,
  };
}

function AssigneeStack({ task }) {
  const count = task.assignees.length;
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      title={task.assignees.map((a) => a.name).join(", ")}
    >
      <Users className="size-3.5" />
      {count}
    </span>
  );
}

// Live overview cards — each one filters the list when clicked.
// "active" merges in-progress + assigned (the tasks currently being worked).
const STAT_CARDS = [
  {
    key: "active",
    statuses: ["in_progress", "assigned"],
    label: "Active",
    Icon: Loader2,
    iconClass: "text-amber-600 dark:text-amber-400",
    ring: "data-[active=true]:border-amber-500/50 data-[active=true]:bg-amber-500/10",
    dot: "bg-amber-500",
  },
  {
    key: "delayed",
    statuses: ["delayed"],
    label: "Delayed",
    Icon: AlertTriangle,
    iconClass: "text-rose-600 dark:text-rose-400",
    ring: "data-[active=true]:border-rose-500/50 data-[active=true]:bg-rose-500/10",
    dot: "bg-rose-500",
  },
  {
    key: "completed",
    statuses: ["completed"],
    label: "Completed",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    ring: "data-[active=true]:border-emerald-500/50 data-[active=true]:bg-emerald-500/10",
    dot: "bg-emerald-500",
  },
  {
    key: "cancelled",
    statuses: ["cancelled"],
    label: "Cancelled",
    Icon: XCircle,
    iconClass: "text-muted-foreground",
    ring: "data-[active=true]:border-foreground/30 data-[active=true]:bg-muted",
    dot: "bg-muted-foreground",
  },
];

function StatCard({ card, count, active, onClick }) {
  const { label, Icon, iconClass, ring, dot } = card;
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left transition-all hover:bg-accent/60 hover:shadow-sm",
        "sm:flex-col sm:items-start sm:gap-2 sm:rounded-xl sm:p-4",
        ring
      )}
    >
      {/* Mobile: number + label sit on one compact row. Desktop: stacked. */}
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs sm:order-1">
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        <span className="truncate">{label}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0 sm:gap-2 sm:order-2 sm:w-full sm:justify-between">
        <span className="text-base font-semibold leading-none tabular-nums sm:text-2xl">
          {count}
        </span>
        <Icon className={cn("size-3.5 shrink-0 sm:size-4", iconClass)} />
      </span>
    </button>
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
  // Subtasks are surfaced in the board as first-class rows; this toggles them.
  const [showSubtasks, setShowSubtasks] = useState(true);

  // The working set: tasks plus their subtasks reshaped as task-like rows, so
  // every count, filter and sort below treats a subtask exactly like a task.
  const items = useMemo(() => {
    if (!showSubtasks) return tasks;
    const rows = [...tasks];
    for (const t of tasks) {
      for (const s of t.subtasks || []) rows.push(subtaskToRow(t, s));
    }
    return rows;
  }, [tasks, showSubtasks]);

  // Live tallies per status, computed off the full set (not the filtered
  // view) so the header always reflects the true totals.
  const counts = useMemo(() => {
    const c = {};
    for (const t of items) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((t) => {
      const mine = t.assignees.find((a) => a.id === currentUser.id);
      if (scope === "mine" && !mine) return false;
      if (scope === "created" && t.assignerId !== currentUser.id) return false;
      if (scope === "done-by-me" && !(mine && mine.status === "completed")) return false;
      if (scope === "drafts" && t.status !== "draft") return false;
      if (status === "active") {
        if (t.status !== "in_progress" && t.status !== "assigned") return false;
      } else if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (
        q &&
        ![
          t.key,
          t.title,
          t.parentKey,
          t.parentTitle,
          toPlainText(t.description),
          t.assignerName,
          ...t.assignees.map((a) => a.name),
        ]
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
  }, [items, query, scope, status, priority, sort, dir, currentUser.id]);

  return (
    <div className="space-y-4">
      {/* Live overview header */}
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-card via-card to-muted/40 p-3 shadow-sm sm:p-5">
        {/* Soft glow accent in the corner for a bit of depth */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">Tasks overview</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length === items.length
                ? `${items.length} ${items.length === 1 ? "item" : "items"} across the board`
                : `${filtered.length} of ${items.length} shown`}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <div className="relative grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {STAT_CARDS.map((card) => (
            <StatCard
              key={card.key}
              card={card}
              count={card.statuses.reduce((n, s) => n + (counts[s] || 0), 0)}
              active={status === card.key}
              onClick={() =>
                setStatus((s) => (s === card.key ? "all" : card.key))
              }
            />
          ))}
        </div>
      </div>

      {/* Top row: scope + create. Scope is a compact dropdown on mobile (so the
          five options never wrap into a broken row) and a tab bar on sm+. */}
      <div className="flex items-center justify-between gap-2">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-40 shrink-0 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopes.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={scope} onValueChange={setScope} className="hidden min-w-0 sm:block">
          <TabsList className="h-auto flex-wrap gap-1 border border-border/70 bg-muted/60 p-1 shadow-sm">
            {scopes.map((s) => (
              <TabsTrigger
                key={s.value}
                value={s.value}
                className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-background/60 data-active:shadow-sm"
              >
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
        <div className="flex flex-wrap items-center gap-2">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="min-w-30 flex-1 sm:w-36 sm:flex-none">
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
            <SelectTrigger className="min-w-36 flex-1 sm:w-40 sm:flex-none">
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
            className="shrink-0"
            title={dir === "asc" ? "Ascending" : "Descending"}
            onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {dir === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>

          <Button
            variant={showSubtasks ? "secondary" : "outline"}
            size="sm"
            title={showSubtasks ? "Hide subtasks" : "Show subtasks"}
            onClick={() => setShowSubtasks((v) => !v)}
            className="shrink-0"
          >
            <ListTree className="size-4" />
            Subtasks
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">No tasks here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {items.length === 0
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
                  href={t.href ?? `/tasks/${t.key}`}
                  className="group/row flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/60 sm:px-4"
                >
                  <span className="hidden w-20 shrink-0 font-mono text-xs font-medium text-muted-foreground md:inline">
                    {t.isSubtask ? t.parentKey : t.key}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      {t.isSubtask && (
                        <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{t.title}</span>
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground md:hidden">
                        {t.isSubtask ? `${t.parentKey} · ${t.key}` : t.key}
                      </span>
                      {t.isSubtask && (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary"
                        >
                          Subtask
                        </Badge>
                      )}
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
