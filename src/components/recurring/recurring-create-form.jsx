"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { RichTextEditor } from "@/components/rich-text";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import {
  SCHEDULE_FREQS,
  SCHEDULE_META,
  WEEKDAYS,
} from "@/lib/recurring-schedule";

export function RecurringCreateForm({ assignees, currentUserId }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [freq, setFreq] = useState(SCHEDULE_FREQS[0]);
  const [intervalDays, setIntervalDays] = useState("2");
  const [weekday, setWeekday] = useState("1"); // Monday
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const onlySelf = !assignees.some((a) => a.id !== currentUserId);

  async function onSubmit(e) {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Give the task a title.");
      return;
    }
    if (selected.length === 0) {
      toast.error("Assign at least one person.");
      return;
    }
    const schedule = { freq };
    if (freq === "everyN") {
      const n = parseInt(intervalDays, 10);
      if (!Number.isFinite(n) || n < 1) {
        toast.error("Enter how many days between each result.");
        return;
      }
      schedule.intervalDays = n;
    }
    if (freq === "weekly") schedule.weekday = parseInt(weekday, 10);

    setSaving(true);
    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        assigneeIds: selected,
        priority,
        schedule,
        startDate,
        endDate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not create recurring task");
      return;
    }
    toast.success("Recurring task created");
    router.push(`/recurring/${data.recurring.key}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/recurring">
          <ArrowLeft className="size-4" />
          Back to recurring
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Daily attendance report"
              className="md:text-base"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>What should be uploaded each day?</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe the result the assignee should upload every scheduled day…"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Assignees{" "}
                  <span className="text-muted-foreground">
                    ({selected.length})
                  </span>
                </Label>
                <UserCombobox
                  users={assignees}
                  value={selected}
                  onChange={setSelected}
                  currentUserId={currentUserId}
                  placeholder="Search a name…"
                />
                {selected.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {onlySelf
                      ? "Assign this to yourself to start logging results."
                      : "Pick who has to upload a result each scheduled day."}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority" className="w-full">
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

              <div className="space-y-3 border-t pt-4">
                <Label htmlFor="freq" className="flex items-center gap-1.5">
                  <Repeat className="size-3.5" />
                  Repeats
                </Label>
                <Select value={freq} onValueChange={setFreq}>
                  <SelectTrigger id="freq" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_FREQS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {SCHEDULE_META[f].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {freq === "everyN" && (
                  <div className="space-y-2">
                    <Label htmlFor="interval">Days between each result</Label>
                    <Input
                      id="interval"
                      type="number"
                      min={1}
                      max={90}
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(e.target.value)}
                    />
                  </div>
                )}

                {freq === "weekly" && (
                  <div className="space-y-2">
                    <Label htmlFor="weekday">On</Label>
                    <Select value={weekday} onValueChange={setWeekday}>
                      <SelectTrigger id="weekday" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d, i) => (
                          <SelectItem key={d} value={String(i)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {SCHEDULE_META[freq].help} There&apos;s no
                  &quot;complete&quot; — it keeps running until you pause or end
                  it.
                </p>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start date</Label>
                  <DateTimePicker
                    id="startDate"
                    mode="date"
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Today"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End date (optional)</Label>
                  <DateTimePicker
                    id="endDate"
                    mode="date"
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Runs indefinitely"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create recurring task
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/recurring">Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
