"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Inbox,
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  CornerDownRight,
  ListTree,
  Users,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
import {
  StatusBadge,
  PriorityBadge,
  RecurringBadge,
} from "@/components/tasks/task-badges";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import { cn, formatDate, toPlainText } from "@/lib/utils";

const DAY_MS = 86_400_000;

// A subtask, reshaped to look exactly like a task so the list, filters, sorts
// and overview counts can treat it identically. Subtask statuses (todo /
// in_progress / submitted / done) map onto the task statuses, and the expected
// date plays the role of the due date so "delayed" works the same way.
function subtaskToRow(task, s) {
  const done = s.status === "done";
  const delayed =
    !done && !!s.expectedDate && new Date(s.expectedDate).getTime() < Date.now();
  const status = done
    ? "completed"
    : delayed
      ? "delayed"
      : s.status === "submitted"
        ? "in_review"
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
// "active" merges in-progress + assigned + in-review (tasks in the pipeline,
// including those submitted and waiting on a reviewer).
const STAT_CARDS = [
  {
    key: "active",
    statuses: ["in_progress", "assigned", "in_review"],
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
  in_review: 1,
  in_progress: 2,
  assigned: 3,
  draft: 4,
  completed: 5,
  cancelled: 6,
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
  // Subtasks stay tucked under their parent; this set holds the ids the user
  // has manually expanded. Filters can also auto-expand a parent (see below).
  const [expanded, setExpanded] = useState(() => new Set());

  // Live tallies per status, computed off the full board (tasks *and* their
  // subtasks) so the overview always reflects the true totals.
  const counts = useMemo(() => {
    const c = {};
    for (const t of tasks) {
      c[t.status] = (c[t.status] || 0) + 1;
      for (const s of t.subtasks || []) {
        const r = subtaskToRow(t, s);
        c[r.status] = (c[r.status] || 0) + 1;
      }
    }
    return c;
  }, [tasks]);

  // Filtering runs against the deferred query so the input stays responsive on
  // big lists — React paints the keystroke first, then the heavier filter pass.
  const deferredQuery = useDeferredValue(query);

  // Precompute a lowercase search string per task and per subtask ONCE. Parsing
  // each HTML description via toPlainText is the costly part; without this, every
  // keystroke re-parsed every description. Now typing is just a substring check.
  const searchIndex = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const taskHay = [
        t.key,
        t.title,
        toPlainText(t.description),
        t.assignerName,
        ...t.assignees.map((a) => a.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const subHays = (t.subtasks || []).map((s) =>
        [s.key, s.title, t.key, t.title, toPlainText(s.description), s.assigneeName, t.assignerName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
      );
      map.set(t.id, { taskHay, subHays });
    }
    return map;
  }, [tasks]);

  // The list shows top-level tasks only; subtasks live nested inside their
  // parent. A task is included when it matches the filters itself OR when any of
  // its subtasks does — in which case we auto-expand it so the match is visible.
  const { list, autoExpand } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filterActive =
      q !== "" || scope !== "all" || status !== "all" || priority !== "all";

    const taskMatches = (t, taskHay) => {
      const mine = t.assignees.find((a) => a.id === currentUser.id);
      if (scope === "mine" && !mine) return false;
      if (scope === "created" && t.assignerId !== currentUser.id) return false;
      if (scope === "done-by-me" && !(mine && mine.status === "completed")) return false;
      if (scope === "drafts" && t.status !== "draft") return false;
      if (status === "active") {
        if (t.status !== "in_progress" && t.status !== "assigned") return false;
      } else if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (q && !taskHay.includes(q)) return false;
      return true;
    };

    const subtaskMatches = (t, s, subHay) => {
      const r = subtaskToRow(t, s);
      const mine = s.assigneeId === currentUser.id;
      if (scope === "mine" && !mine) return false;
      if (scope === "created" && t.assignerId !== currentUser.id) return false;
      if (scope === "done-by-me" && !(mine && r.status === "completed")) return false;
      if (scope === "drafts") return false; // subtasks are never drafts
      if (status === "active") {
        if (r.status !== "in_progress" && r.status !== "assigned") return false;
      } else if (status !== "all" && r.status !== status) return false;
      if (priority !== "all" && r.priority !== priority) return false;
      if (q && !subHay.includes(q)) return false;
      return true;
    };

    const auto = new Set();
    const out = tasks.filter((t) => {
      const idx = searchIndex.get(t.id);
      const own = taskMatches(t, idx.taskHay);
      const subs = t.subtasks || [];
      const subHit = subs.some((s, i) => subtaskMatches(t, s, idx.subHays[i]));
      if (filterActive && subHit) auto.add(t.id);
      return own || subHit;
    });

    const cmp = compareBy(sort);
    const factor = dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const base = cmp(a, b);
      // Keep null due dates last regardless of direction.
      if (sort === "due" && base !== 0 && (!a.dueDate || !b.dueDate)) return base;
      return base * factor;
    });
    return { list: out, autoExpand: auto };
  }, [tasks, searchIndex, deferredQuery, scope, status, priority, sort, dir, currentUser.id]);

  // Parents that actually have subtasks — drives the per-row expander and the
  // "Expand all" control.
  const parentsWithSubs = useMemo(
    () => tasks.filter((t) => (t.subtasks?.length || 0) > 0).map((t) => t.id),
    [tasks]
  );
  const allExpanded =
    parentsWithSubs.length > 0 && parentsWithSubs.every((id) => expanded.has(id));

  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setExpanded(allExpanded ? new Set() : new Set(parentsWithSubs));

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
              {list.length === tasks.length
                ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} across the board`
                : `${list.length} of ${tasks.length} tasks shown`}
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

          {parentsWithSubs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              title={allExpanded ? "Collapse all subtasks" : "Expand all subtasks"}
              onClick={toggleAll}
              className="shrink-0"
            >
              <ListTree className="size-4" />
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
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
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="min-w-[680px]">
            {/* Column header */}
            <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground sm:px-4">
              <span className="flex-1">Issue</span>
              <span className="w-28 shrink-0">Status</span>
              <span className="w-24 shrink-0">Due</span>
              <span className="w-24 shrink-0">Priority</span>
              <span className="w-20 shrink-0">Assignees</span>
              <span className="w-20 shrink-0">Subtasks</span>
            </div>
            <ul className="divide-y">
              {list.map((t) => {
                const subs = t.subtasks || [];
                const hasSubs = subs.length > 0;
                const open = hasSubs && (expanded.has(t.id) || autoExpand.has(t.id));
                return (
                  <li key={t.id} className={cn(open && "bg-muted/20")}>
                    {/* Parent row — the whole row navigates via the stretched
                        link; the Subtasks cell sits above it to toggle expand. */}
                    <div className="group/row relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/60 sm:px-4">
                      <Link href={`/tasks/${t.key}`} className="absolute inset-0 z-[1]">
                        <span className="sr-only">Open {t.title}</span>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.title}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {t.key}
                          </span>
                          <RecurringBadge
                            recurrence={t.recurrence}
                            className="relative z-2 gap-0.5 px-1 py-0 text-[10px]"
                          />
                        </span>
                      </div>
                      <div className="w-28 shrink-0">
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="w-24 shrink-0">
                        {t.dueDate ? (
                          <>
                            <span
                              className={cn(
                                "text-xs",
                                t.delayed
                                  ? "font-medium text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {formatDate(t.dueDate)}
                            </span>
                            {t.delayed && t.daysLate > 0 && (
                              <span className="block text-[10px] font-medium text-rose-600 dark:text-rose-400">
                                {t.daysLate}d late
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                      <div className="w-24 shrink-0">
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <div className="w-20 shrink-0">
                        <AssigneeStack task={t} />
                      </div>
                      <div className="w-20 shrink-0">
                        {hasSubs ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(t.id)}
                            aria-expanded={open}
                            aria-label={open ? "Hide subtasks" : `Show ${subs.length} subtasks`}
                            className="relative z-[2] inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
                          >
                            <span className="tabular-nums">{subs.length}</span>
                            <ChevronDown
                              className={cn(
                                "size-3.5 transition-transform",
                                open && "rotate-180"
                              )}
                            />
                          </button>
                        ) : (
                          <span className="pl-2 text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>

                    {/* Nested subtasks — same columns, indented with a tree rail
                        so they clearly read as children of the task above. */}
                    {open && (
                      <div className="relative border-t bg-muted/20">
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 left-8 w-px bg-border sm:left-12"
                        />
                        <ul className="divide-y divide-border/40">
                          {subs.map((s) => {
                            const r = subtaskToRow(t, s);
                            return (
                              <li key={r.id} className="group/sub relative">
                                <Link href={r.href} className="absolute inset-0 z-[1]">
                                  <span className="sr-only">Open {r.title}</span>
                                </Link>
                                <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 sm:px-4">
                                  <div className="flex min-w-0 flex-1 items-center gap-2 pl-6 sm:pl-9">
                                    <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                                    <div className="min-w-0">
                                      <span className="block truncate text-sm font-medium">
                                        {r.title}
                                      </span>
                                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                                        {r.key}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-28 shrink-0">
                                    <StatusBadge status={r.status} />
                                  </div>
                                  <div className="w-24 shrink-0">
                                    {r.dueDate ? (
                                      <>
                                        <span
                                          className={cn(
                                            "text-xs",
                                            r.delayed
                                              ? "font-medium text-rose-600 dark:text-rose-400"
                                              : "text-muted-foreground"
                                          )}
                                        >
                                          {formatDate(r.dueDate)}
                                        </span>
                                        {r.delayed && r.daysLate > 0 && (
                                          <span className="block text-[10px] font-medium text-rose-600 dark:text-rose-400">
                                            {r.daysLate}d late
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/50">—</span>
                                    )}
                                  </div>
                                  <div className="w-24 shrink-0">
                                    <PriorityBadge priority={r.priority} />
                                  </div>
                                  <div className="w-20 shrink-0">
                                    <AssigneeStack task={r} />
                                  </div>
                                  {/* Subtasks column — subtasks have none */}
                                  <div className="w-20 shrink-0" />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
