"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  ListChecks,
  GitBranch,
  CalendarOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDateTime } from "@/lib/utils";

// Sunday-first week to match the OS/browser date pickers people are used to.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_NARROW = ["S", "M", "T", "W", "T", "F", "S"];
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
    label: "Due",
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

// 6×7 day matrix for the month containing `cursor`, week starting Sunday.
function buildMatrix(cursor) {
  const first = startOfMonth(cursor);
  const lead = first.getDay(); // days before the 1st (Sun = 0)
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

function eventIcon(ev) {
  if (ev.type === "meeting") return CalendarClock;
  if (ev.type === "subtask") return GitBranch;
  return ListChecks;
}

export function CalendarClient({ events }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const [view, setView] = useState("month");
  const [selectedDay, setSelectedDay] = useState(() => today);

  // Default to "my schedule" when the user has anything of their own; managers
  // who mostly see other people's work fall back to "all" so it's never empty.
  const hasMine = useMemo(() => events.some((e) => e.mine), [events]);
  const [scope, setScope] = useState(() =>
    events.some((e) => e.mine) ? "mine" : "all"
  );

  const scoped = useMemo(
    () => (scope === "mine" ? events.filter((e) => e.mine) : events),
    [events, scope]
  );

  // Parse the date and recompute `overdue` in the browser's timezone, so the
  // red "overdue" styling agrees with the day the event is bucketed under.
  // (The server computes overdue in its own TZ, which can land a day off for
  // users in another timezone.)
  const nowMs = today.getTime();
  const decorate = useCallback(
    (ev) => {
      const d = new Date(ev.date);
      return {
        ...ev,
        _date: d,
        overdue: ev.type !== "meeting" && !ev.done && d.getTime() < nowMs,
      };
    },
    [nowMs]
  );

  // Bucket events by calendar day, each bucket sorted by time.
  const byDay = useMemo(() => {
    const map = new Map();
    for (const ev of scoped) {
      const d = new Date(ev.date);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(decorate(ev));
    }
    for (const list of map.values()) {
      list.sort((a, b) => a._date - b._date);
    }
    return map;
  }, [scoped, decorate]);

  const days = useMemo(() => buildMatrix(cursor), [cursor]);

  const upcoming = useMemo(() => {
    const startMs = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();
    return scoped
      .map(decorate)
      .filter(
        (ev) => !Number.isNaN(ev._date.getTime()) && ev._date.getTime() >= startMs
      )
      .sort((a, b) => a._date - b._date)
      .slice(0, 60);
  }, [scoped, today, decorate]);

  const selectedEvents = byDay.get(dayKey(selectedDay)) || [];

  const goMonth = (delta) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  function selectDay(d) {
    setSelectedDay(d);
    if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) {
      setCursor(startOfMonth(d));
    }
  }

  function goToday() {
    setCursor(startOfMonth(today));
    setSelectedDay(today);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="min-w-32 text-base font-semibold tracking-tight sm:min-w-42 sm:text-lg">
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
            <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
              Today
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Legend />
          {hasMine && (
            <Tabs value={scope} onValueChange={setScope}>
              <TabsList className="h-8">
                <TabsTrigger value="mine" className="text-xs">
                  Mine
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
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
        <div className="space-y-4">
          <MonthGrid
            days={days}
            cursor={cursor}
            today={today}
            byDay={byDay}
            selectedDay={selectedDay}
            onSelectDay={selectDay}
          />
          <DayDetail date={selectedDay} items={selectedEvents} today={today} />
        </div>
      ) : (
        <AgendaList items={upcoming} today={today} />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
      {Object.values(KIND_STYLES).map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", s.dot)} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MonthGrid({ days, cursor, today, byDay, selectedDay, onSelectDay }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="px-1 py-2 text-center text-[11px] font-medium text-muted-foreground sm:text-xs"
          >
            <span className="sm:hidden">{WEEKDAYS_NARROW[i]}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selectedDay);
          const list = byDay.get(dayKey(d)) || [];
          const shown = list.slice(0, 3);
          const extra = list.length - shown.length;

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={d.toDateString()}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(d);
                }
              }}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col border-b border-r p-1 outline-none transition-colors last:border-r-0 sm:min-h-26 sm:p-1.5",
                (i + 1) % 7 === 0 && "border-r-0",
                i >= 35 && "border-b-0",
                inMonth ? "bg-card hover:bg-accent/40" : "bg-muted/20",
                isSelected && "ring-2 ring-inset ring-primary/60",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              )}
            >
              <div className="mb-0.5 flex justify-end sm:mb-1">
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

              {/* Mobile: compact dots */}
              <div className="mt-auto flex min-h-3 flex-wrap items-center gap-1 sm:hidden">
                {shown.map((ev) => (
                  <span
                    key={ev.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      KIND_STYLES[eventKind(ev)].dot
                    )}
                  />
                ))}
                {extra > 0 && (
                  <span className="text-[9px] font-medium leading-none text-muted-foreground">
                    +{extra}
                  </span>
                )}
              </div>

              {/* Desktop: text chips */}
              <div className="hidden space-y-1 sm:block">
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
      title={ev.subtitle ? `${ev.title} · ${ev.subtitle}` : ev.title}
      onClick={(e) => e.stopPropagation()}
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

// Focused view of a single day's events — the primary way to read the calendar
// on a phone, and a handy detail panel on desktop.
function DayDetail({ date, items, today }) {
  const isToday = sameDay(date, today);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <span className="text-sm font-semibold">
          {date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
        </span>
        {isToday && (
          <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
            Today
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing scheduled on this day.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((ev) => {
            const style = KIND_STYLES[eventKind(ev)];
            const Icon = eventIcon(ev);
            return (
              <li key={ev.id}>
                <Link
                  href={ev.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", style.dot)}
                  />
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        ev.done &&
                          "text-muted-foreground line-through decoration-muted-foreground/40"
                      )}
                    >
                      {ev.title}
                    </p>
                    {ev.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">
                        {ev.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(ev._date)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
                const Icon = eventIcon(ev);
                return (
                  <Link
                    key={ev.id}
                    href={ev.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          ev.done &&
                            "text-muted-foreground line-through decoration-muted-foreground/40"
                        )}
                      >
                        {ev.title}
                      </p>
                      {ev.subtitle && (
                        <p className="truncate text-xs text-muted-foreground">
                          {ev.subtitle}
                        </p>
                      )}
                    </div>
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
