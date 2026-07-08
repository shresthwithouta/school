"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Repeat,
  MoreVertical,
  Pause,
  Play,
  Square,
  Pencil,
  Trash2,
  Loader2,
  Check,
  Send,
  Clock,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { AttachmentUploader, AttachmentList } from "@/components/attachments";
import { PriorityBadge } from "@/components/tasks/task-badges";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import {
  describeSchedule,
  dueDaysBetween,
  isDueOn,
  dayKeyOf,
  todayDayKey,
  formatDayKey,
  weekdayOf,
  WEEKDAYS,
} from "@/lib/recurring-schedule";
import { canManage, canManageTarget, isOwner } from "@/lib/rbac";
import { getInitials, formatDateTime } from "@/lib/utils";

const ACTIVITY_PAGE_SIZE = 6;

// Client mirror of the server's entry-visibility rule (lib/recurring). Lets the
// grid show a row only for people whose uploads this viewer may actually see.
function canSeeAssignee(user, r, assignee) {
  if (assignee.id === user.id) return true;
  if (r.assignerId === user.id) return true;
  if (isOwner(user.role)) return true;
  if (canManage(user.role)) return canManageTarget(user.role, assignee.role);
  return false;
}

function StateBadge({ r }) {
  if (!r.active) {
    return (
      <Badge variant="outline" className="gap-1 border-foreground/20 bg-muted text-muted-foreground">
        Ended
      </Badge>
    );
  }
  if (r.paused) {
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

export function RecurringDetailClient({ recurring, assignees, currentUser }) {
  const router = useRouter();
  const [r, setR] = useState(recurring);
  const [busy, setBusy] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const today = todayDayKey();
  const startKey = dayKeyOf(r.startDate) || today;
  const endKey = dayKeyOf(r.endDate);
  const dueToday =
    r.active && !r.paused && (!endKey || today <= endKey) && isDueOn(r.schedule, today, startKey);

  // Columns of the log grid — recent due days, newest first.
  const days = useMemo(
    () => dueDaysBetween(r.schedule, r.startDate, r.endDate),
    [r.schedule, r.startDate, r.endDate]
  );

  // Rows the viewer may see (their own, or — for the creator/managers — others').
  const rows = useMemo(
    () => r.assignees.filter((a) => canSeeAssignee(currentUser, r, a)),
    [r, currentUser]
  );

  // Fast lookup: `${assigneeId}::${day}` → entry.
  const entryMap = useMemo(() => {
    const m = new Map();
    for (const e of r.entries || []) m.set(`${e.assigneeId}::${e.day}`, e);
    return m;
  }, [r.entries]);

  const myEntryToday = entryMap.get(`${currentUser.id}::${today}`);
  const [viewEntry, setViewEntry] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  async function removeEntry(entry) {
    setDeletingEntryId(entry.id);
    const res = await fetch(`/api/recurring/${r.id}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: entry.id }),
    });
    const data = await res.json().catch(() => ({}));
    setDeletingEntryId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not remove this response");
      return;
    }
    setR(data.recurring);
    toast.success("Response removed");
    router.refresh();
  }

  async function patch(body, okMsg) {
    setBusy(true);
    const res = await fetch(`/api/recurring/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong");
      return false;
    }
    setR(data.recurring);
    if (okMsg) toast.success(okMsg);
    router.refresh();
    return true;
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/recurring/${r.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete");
      return;
    }
    toast.success("Recurring task deleted");
    router.push("/recurring");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/recurring">
          <ArrowLeft className="size-4" />
          Back to recurring
        </Link>
      </Button>

      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{r.title}</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {r.key} · created by {r.assignerName}
            </p>
          </div>
          {r.canEdit && (
            <ActionMenu r={r} busy={busy} patch={patch} remove={remove} />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-indigo-500/30 bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-400"
          >
            <Repeat className="size-3" />
            {describeSchedule(r.schedule)}
          </Badge>
          <PriorityBadge priority={r.priority} />
          <StateBadge r={r} />
          <span className="text-xs text-muted-foreground">
            {formatDayKey(startKey)}
            {endKey ? ` → ${formatDayKey(endKey)}` : " → ongoing"}
          </span>
        </div>

        {r.description && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              What to upload each scheduled day
            </p>
            <RichText html={r.description} className="text-sm" />
          </div>
        )}

        {r.attachments?.length > 0 && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Reference files
            </p>
            <AttachmentList attachments={r.attachments} />
          </div>
        )}
      </div>

      {/* Today panel — only for assignees, when a result is due today */}
      {r.isAssignee && (
        <TodayPanel
          r={r}
          setR={setR}
          dueToday={dueToday}
          myEntryToday={myEntryToday}
          today={today}
          router={router}
          currentUser={currentUser}
        />
      )}

      {/* Daily log summary — today's status per person, plus a calendar for any other day */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Daily log</h2>
            <span className="text-xs text-muted-foreground">
              {rows.length === 1 && rows[0].id === currentUser.id
                ? "your uploads"
                : `${rows.length} ${rows.length === 1 ? "person" : "people"}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No one to show yet.
            </p>
          ) : days.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No scheduled days yet.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((a) => {
                const e = entryMap.get(`${a.id}::${today}`);
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {getInitials(a.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.name}
                        {a.id === currentUser.id ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Today · {formatDayKey(today)}
                      </p>
                    </div>
                    {e ? (
                      <button
                        type="button"
                        onClick={() => setViewEntry(e)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                      >
                        <Check className="size-3.5" /> Uploaded
                      </button>
                    ) : dueToday ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> Awaiting
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Not due today</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length > 0 && days.length > 0 && (
            <div className="border-t pt-3">
              <CalendarHistory
                r={r}
                rows={rows}
                days={days}
                entryMap={entryMap}
                today={today}
                startKey={startKey}
                endKey={endKey}
                currentUser={currentUser}
                setViewEntry={setViewEntry}
                removeEntry={removeEntry}
                deletingEntryId={deletingEntryId}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      {r.activity?.length > 0 && (
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold">Activity</h2>
            <ul className="space-y-1.5">
              {(() => {
                const allActivity = [...r.activity].reverse();
                const visible = showAllActivity
                  ? allActivity
                  : allActivity.slice(0, ACTIVITY_PAGE_SIZE);
                return visible.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.actorName}</span>
                    <span>{a.message}</span>
                    <span className="ml-auto whitespace-nowrap">{formatDateTime(a.createdAt)}</span>
                  </li>
                ));
              })()}
            </ul>
            {r.activity.length > ACTIVITY_PAGE_SIZE && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowAllActivity((v) => !v)}
              >
                {showAllActivity ? "Show less" : `See all activity (${r.activity.length})`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* View an entry */}
      <Dialog open={!!viewEntry} onOpenChange={(o) => !o && setViewEntry(null)}>
        <DialogContent>
          {viewEntry && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {viewEntry.assigneeName} · {formatDayKey(viewEntry.day)}
                </DialogTitle>
                <DialogDescription>
                  Uploaded {formatDateTime(viewEntry.updatedAt || viewEntry.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <p className="whitespace-pre-wrap text-sm">{viewEntry.note}</p>
                <AttachmentList attachments={viewEntry.files} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Calendar picker for history — one dot per due day, click to see that day ──
const STATUS_META = {
  done: { dot: "bg-emerald-500", cell: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  partial: { dot: "bg-amber-500", cell: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  missed: { dot: "bg-rose-500", cell: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  pending: { dot: "bg-muted-foreground/50", cell: "bg-muted text-muted-foreground" },
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthKeyOf(dayKey) {
  return dayKey.slice(0, 7);
}

function addMonths(monthKeyStr, delta) {
  let [y, m] = monthKeyStr.split("-").map(Number);
  const idx = (y * 12 + (m - 1)) + delta;
  y = Math.floor(idx / 12);
  m = (idx % 12) + 1;
  return `${y}-${pad2(m)}`;
}

function daysInMonth(monthKeyStr) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Padded 7-col grid of day keys (nulls for the leading/trailing blanks).
function buildMonthGrid(monthKeyStr) {
  const first = `${monthKeyStr}-01`;
  const leading = weekdayOf(first);
  const total = daysInMonth(monthKeyStr);
  const cells = Array(leading).fill(null);
  for (let d = 1; d <= total; d++) cells.push(`${monthKeyStr}-${pad2(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function CalendarHistory({
  r,
  rows,
  days,
  entryMap,
  today,
  startKey,
  endKey,
  currentUser,
  setViewEntry,
  removeEntry,
  deletingEntryId,
}) {
  const initialDay = days.includes(today) ? today : (days[0] ?? today);
  const [viewMonth, setViewMonth] = useState(() => monthKeyOf(initialDay));
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const minMonth = monthKeyOf(startKey);
  const maxMonth = monthKeyOf(endKey && endKey < today ? endKey : today);

  function dayStatus(d) {
    if (!d) return null;
    if (d > today || d < startKey || (endKey && d > endKey)) return null;
    if (!isDueOn(r.schedule, d, startKey)) return null;
    const submitted = rows.filter((a) => entryMap.has(`${a.id}::${d}`)).length;
    if (submitted === 0) return d === today ? "pending" : "missed";
    if (submitted === rows.length) return "done";
    return "partial";
  }

  const grid = buildMonthGrid(viewMonth);
  const [gy, gm] = viewMonth.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(gy, gm - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={viewMonth <= minMonth}
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={viewMonth >= maxMonth}
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            const status = dayStatus(d);
            const meta = status ? STATUS_META[status] : null;
            const isSelected = d && d === selectedDay;
            const isToday = d === today;
            return (
              <button
                key={d ?? `blank-${i}`}
                type="button"
                disabled={!d || !status}
                onClick={() => d && status && setSelectedDay(d)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                  !d
                    ? "invisible"
                    : status
                      ? `${meta.cell} hover:opacity-80 ${isSelected ? "ring-2 ring-primary" : ""}`
                      : "text-muted-foreground/40"
                } ${isToday ? "font-semibold" : ""}`}
              >
                {d ? Number(d.slice(-2)) : ""}
                {status && (
                  <span className={`absolute bottom-1 size-1 rounded-full ${meta.dot}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" /> All submitted</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" /> Partial</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-rose-500" /> Missed</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/50" /> Awaiting</span>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
          <p className="text-sm font-semibold">{formatDayKey(selectedDay)}</p>
          {selectedDay === today && (
            <Badge variant="outline" className="text-[10px]">Today</Badge>
          )}
        </div>
        <ul className="divide-y">
          {rows.map((a) => {
            const e = entryMap.get(`${a.id}::${selectedDay}`);
            const past = selectedDay < today;
            const canDelete = e && r.canEdit;
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {getInitials(a.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {a.name}
                  {a.id === currentUser.id ? " (you)" : ""}
                </span>
                {e ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewEntry(e)}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                    >
                      <Check className="size-3" /> View
                    </button>
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            title="Delete this response"
                            disabled={deletingEntryId === e.id}
                            className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
                          >
                            {deletingEntryId === e.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Removes {a.name}&apos;s result for {formatDayKey(selectedDay)},
                              including any attached files. This can&apos;t be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeEntry(e)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                ) : past ? (
                  <span className="text-[11px] text-rose-500">Missed</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Awaiting</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ── Today's upload panel ───────────────────────────────────────────
function TodayPanel({ r, setR, dueToday, myEntryToday, today, router, currentUser }) {
  void currentUser;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(myEntryToday?.note ?? "");
  const [files, setFiles] = useState(myEntryToday?.files ?? []);
  const [saving, setSaving] = useState(false);

  const showForm = editing || !myEntryToday;

  if (!dueToday) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            {!r.active
              ? "This recurring task has ended."
              : r.paused
                ? "This recurring task is paused — no result is expected right now."
                : "No result is due today. Come back on the next scheduled day."}
          </p>
        </CardContent>
      </Card>
    );
  }

  async function submit() {
    if (note.trim().length < 3) {
      toast.error("Add a short note about today's work.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/recurring/${r.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: today, note, files }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not upload");
      return;
    }
    setR(data.recurring);
    setEditing(false);
    toast.success("Today's result uploaded");
    router.refresh();
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-primary" />
            Today · {formatDayKey(today)}
          </h2>
          {myEntryToday && !editing && (
            <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Check className="size-3" /> Uploaded
            </Badge>
          )}
        </div>

        {showForm ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="note">Today&apos;s result</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you do / what are you uploading today?"
                rows={3}
              />
            </div>
            <AttachmentList
              attachments={files}
              onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AttachmentUploader
                onAdd={(a) =>
                  setFiles((f) => [
                    ...f,
                    {
                      ...a,
                      id: a.id ?? crypto.randomUUID(),
                      uploadedByName: a.uploadedByName ?? "You",
                      createdAt: a.createdAt ?? new Date().toISOString(),
                    },
                  ])
                }
                disabled={saving}
              />
              <div className="flex gap-2">
                {myEntryToday && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setNote(myEntryToday.note);
                      setFiles(myEntryToday.files ?? []);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="button" size="sm" onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {myEntryToday ? "Update" : "Upload"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm">{myEntryToday.note}</p>
            <AttachmentList attachments={myEntryToday.files} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(true);
                setNote(myEntryToday.note);
                setFiles(myEntryToday.files ?? []);
              }}
            >
              <Pencil className="size-4" />
              Edit today&apos;s result
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Creator/manager action menu + edit dialog ──────────────────────
function ActionMenu({ r, busy, patch, remove }) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={busy} aria-label="Actions">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
          {r.active &&
            (r.paused ? (
              <DropdownMenuItem onClick={() => patch({ action: "resume" }, "Resumed")}>
                <Play className="size-4" /> Resume
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => patch({ action: "pause" }, "Paused")}>
                <Pause className="size-4" /> Pause
              </DropdownMenuItem>
            ))}
          {r.active && (
            <DropdownMenuItem onClick={() => patch({ action: "end" }, "Ended")}>
              <Square className="size-4" /> End
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this recurring task?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the task and every uploaded result.
                  This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDialog r={r} open={editOpen} setOpen={setEditOpen} patch={patch} />
    </>
  );
}

function EditDialog({ r, open, setOpen, patch }) {
  const [title, setTitle] = useState(r.title);
  const [description, setDescription] = useState(r.description ?? "");
  const [priority, setPriority] = useState(r.priority);
  const [endDate, setEndDate] = useState(r.endDate ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (title.trim().length < 2) {
      toast.error("Give the task a title.");
      return;
    }
    setSaving(true);
    const ok = await patch(
      { title, description, priority, endDate },
      "Saved"
    );
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit recurring task</DialogTitle>
          <DialogDescription>
            Schedule and assignees stay as set; edit the details or end date here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="edit-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>End date (optional)</Label>
            <DateTimePicker
              mode="date"
              value={endDate}
              onChange={setEndDate}
              placeholder="Runs indefinitely"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
