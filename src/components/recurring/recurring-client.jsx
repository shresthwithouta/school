"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Repeat,
  Search,
  Inbox,
  Pause,
  CheckCircle2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge } from "@/components/tasks/task-badges";
import {
  describeSchedule,
  isDueOn,
  dayKeyOf,
  todayDayKey,
} from "@/lib/recurring-schedule";
import { cn, getInitials, toPlainText } from "@/lib/utils";

// A recurring task's live state, computed for the list row.
function summarize(r) {
  const today = todayDayKey();
  const startKey = dayKeyOf(r.startDate) || today;
  const ended = !r.active;
  const endKey = dayKeyOf(r.endDate);
  const dueToday =
    r.active &&
    !r.paused &&
    (!endKey || today <= endKey) &&
    isDueOn(r.schedule, today, startKey);
  const loggedToday = new Set(
    (r.entries || []).filter((e) => e.day === today).map((e) => e.assigneeId)
  ).size;
  const total = (r.assignees || []).length;
  const state = ended ? "ended" : r.paused ? "paused" : "active";
  return { dueToday, loggedToday, total, state };
}

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "Assigned to me" },
  { value: "created", label: "Created by me" },
  { value: "active", label: "Active" },
];

function StateChip({ state }) {
  if (state === "ended") {
    return (
      <Badge variant="outline" className="gap-1 border-foreground/20 bg-muted text-muted-foreground">
        <CheckCircle2 className="size-3" /> Ended
      </Badge>
    );
  }
  if (state === "paused") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <Pause className="size-3" /> Paused
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Active
    </Badge>
  );
}

export function RecurringClient({ recurring, currentUser }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recurring
      .map((r) => ({ r, sum: summarize(r), desc: toPlainText(r.description) }))
      .filter(({ r }) => {
        const mine = r.assignees.some((a) => a.id === currentUser.id);
        if (scope === "mine" && !mine) return false;
        if (scope === "created" && r.assignerId !== currentUser.id) return false;
        if (scope === "active" && (!r.active || r.paused)) return false;
        return true;
      })
      .filter(({ r, desc }) => {
        if (!q) return true;
        const hay = [
          r.key,
          r.title,
          desc,
          r.assignerName,
          ...r.assignees.map((a) => a.name),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [recurring, query, scope, currentUser.id]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-card via-card to-muted/40 p-3 shadow-sm sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
              <Repeat className="size-4 text-indigo-500" />
              Recurring tasks
            </h2>
            <p className="text-xs text-muted-foreground">
              Ongoing assignments — a result is uploaded each scheduled day.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/recurring/new">
              <Plus className="size-4" />
              Create
            </Link>
          </Button>
        </div>
      </div>

      {/* Scope + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Tabs value={scope} onValueChange={setScope} className="min-w-0">
          <TabsList className="h-auto flex-wrap gap-1 border border-border/70 bg-muted/60 p-1 shadow-sm">
            {SCOPES.map((s) => (
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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or person…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">No recurring tasks here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {recurring.length === 0
              ? "Create a recurring task to have someone upload a result every day (or every few days)."
              : "Try a different filter or search."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ r, sum }) => (
            <li key={r.id}>
              <Link
                href={`/recurring/${r.key}`}
                className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {r.key} · by {r.assignerName}
                    </p>
                  </div>
                  <StateChip state={sum.state} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="gap-1 border-indigo-500/30 bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-400"
                  >
                    <Repeat className="size-3" />
                    {describeSchedule(r.schedule)}
                  </Badge>
                  <PriorityBadge priority={r.priority} />
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex -space-x-1.5">
                      {r.assignees.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex size-5 items-center justify-center rounded-full border border-background bg-primary/10 text-[9px] font-medium text-primary"
                          title={a.name}
                        >
                          {getInitials(a.name)}
                        </span>
                      ))}
                    </span>
                    <span className="inline-flex items-center gap-0.5 tabular-nums">
                      <Users className="size-3" />
                      {sum.total}
                    </span>
                  </span>
                  {sum.dueToday ? (
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        sum.loggedToday >= sum.total
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {sum.loggedToday}/{sum.total} logged today
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">
                      {sum.state === "active" ? "Not due today" : ""}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
