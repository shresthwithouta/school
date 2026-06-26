"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  ListChecks,
  CalendarOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDateTime } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Neutral, non-bluish palette. Each event kind gets a soft tinted chip plus a
// solid dot so the colour reads at a glance without flooding the cell.
const KIND_STYLES = {
  meeting: {
    label: "Meetings",
    dot: "bg-emerald-500",
    chip:
      "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
  },
  taskOpen: {
    label: "Tasks due",
    dot: "bg-amber-500",
    chip:
      "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
  },
  taskOverdue: {
    label: "Overdue",
    dot: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300",
  },
  taskDone: {
    label: "Done",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    chip:
      "bg-muted text-muted-foreground hover:bg-muted/70 line-through decoration-muted-foreground/40",
  },
};

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

// 6×7 day matrix for the month containing `cursor`, week starting Monday.
function buildMatrix(cursor) {
  const first = startOfMonth(cursor);
  const lead = (first.getDay() + 6) % 7; // days before the 1st (Mon = 0)
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function eventKind(ev) {
  if (ev.type === "meeting") return "meeting";
  if (ev.overdue) return "taskOverdue";
  if (ev.done) return "taskDone";
  return "taskOpen";
}

export function CalendarClient({ events }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const [view, setView] = useState("month");

  // Bucket events by calendar day, each bucket sorted by time.
  const byDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const d = new Date(ev.date);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ ...ev, _date: d });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a._date - b._date);
    }
    return map;
  }, [events]);

  const days = useMemo(() => buildMatrix(cursor), [cursor]);

  const upcoming = useMemo(() => {
    const startMs = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();
    return events
      .map((ev) => ({ ...ev, _date: new Date(ev.date) }))
      .filter((ev) => !Number.isNaN(ev._date.getTime()) && ev._date.getTime() >= startMs)
      .sort((a, b) => a._date - b._date)
      .slice(0, 40);
  }, [events, today]);

  const goMonth = (delta) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="min-w-[10.5rem] text-lg font-semibold tracking-tight">
            {MONTHS[cursor.getMonth()]}{" "}
            <span className="text-muted-foreground">{cursor.getFullYear()}</span>
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => goMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => goMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCursor(startOfMonth(today))}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Legend />
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-8">
              <TabsTrigger value="month" className="text-xs">
                Month
              </TabsTrigger>
              <TabsTrigger value="agenda" className="text-xs">
                Agenda
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          days={days}
          cursor={cursor}
          today={today}
          byDay={byDay}
        />
      ) : (
        <AgendaList items={upcoming} today={today} />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
      {Object.values(KIND_STYLES).map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", s.dot)} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MonthGrid({ days, cursor, today, byDay }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const list = byDay.get(dayKey(d)) || [];
          const shown = list.slice(0, 3);
          const extra = list.length - shown.length;

          return (
            <div
              key={i}
              className={cn(
                "min-h-[6.5rem] border-b border-r p-1.5 transition-colors last:border-r-0",
                (i + 1) % 7 === 0 && "border-r-0",
                i >= 35 && "border-b-0",
                inMonth ? "bg-card hover:bg-accent/30" : "bg-muted/20"
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    isToday
                      ? "bg-foreground font-semibold text-background"
                      : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/40"
                  )}
                >
                  {d.getDate()}
                </span>
              </div>

              <div className="space-y-1">
                {shown.map((ev) => (
                  <EventChip key={ev.id} ev={ev} />
                ))}
                {extra > 0 && (
                  <div className="px-1 text-[11px] font-medium text-muted-foreground">
                    +{extra} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({ ev }) {
  const style = KIND_STYLES[eventKind(ev)];
  return (
    <Link
      href={ev.href}
      title={ev.title}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight transition-colors",
        style.chip
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
      <span className="truncate">{ev.title}</span>
    </Link>
  );
}

function AgendaList({ items, today }) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed bg-card p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarOff className="size-6" />
        </div>
        <h3 className="mt-3 font-medium">Nothing upcoming</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Scheduled meetings and tasks with a due date will appear here.
        </p>
      </div>
    );
  }

  // Group by day for readable sectioning.
  const groups = [];
  let current = null;
  for (const ev of items) {
    const k = dayKey(ev._date);
    if (!current || current.key !== k) {
      current = { key: k, date: ev._date, items: [] };
      groups.push(current);
    }
    current.items.push(ev);
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {groups.map((g) => {
        const isToday = sameDay(g.date, today);
        return (
          <div key={g.key} className="border-b last:border-b-0">
            <div className="flex items-baseline gap-2 bg-muted/40 px-4 py-2">
              <span className="text-sm font-semibold">
                {g.date.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              {isToday && (
                <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                  Today
                </span>
              )}
            </div>
            <div className="divide-y">
              {g.items.map((ev) => {
                const style = KIND_STYLES[eventKind(ev)];
                const Icon = ev.type === "meeting" ? CalendarClock : ListChecks;
                return (
                  <Link
                    key={ev.id}
                    href={ev.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {ev.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(ev._date)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
