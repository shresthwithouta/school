"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Repeat, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { RECURRENCE_FREQS, RECURRENCE_META } from "@/lib/recurrence";

export function TaskCreateForm({ assignees, currentUserId }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState(RECURRENCE_FREQS[0]);
  const [saving, setSaving] = useState(false);

  const isDraft = selected.length === 0;
  // A recurring rule needs someone to remind — it only takes effect once the
  // task is actually assigned.
  const recurringActive = recurring && !isDraft;
  // Low-rank staff may have no one below them to delegate to — they can still
  // create a task for themselves, so make that explicit rather than leaving a
  // seemingly empty, dead-end picker.
  const onlySelf = !assignees.some((a) => a.id !== currentUserId);

  async function onSubmit(e) {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Give the task a title.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        assigneeIds: selected,
        priority,
        // A recurring task derives each occurrence's due date, so the manual
        // picker is only sent for one-off tasks.
        dueDate: recurringActive ? "" : dueDate,
        recurrence: recurringActive ? { freq } : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not create task");
      return;
    }
    toast.success(isDraft ? "Draft saved" : "Task created");
    router.push(`/tasks/${data.task.key}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/tasks">
          <ArrowLeft className="size-4" />
          Back to tasks
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
              placeholder="Short summary of the task"
              className="md:text-base"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Add details, context or steps…"
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
                {isDraft && (
                  <p className="text-xs text-muted-foreground">
                    {onlySelf
                      ? "No one assigned yet. You can assign this task to yourself, or leave it empty to save as a draft."
                      : "No one assigned — this will be saved as a draft."}
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
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="recurring"
                      className="flex items-center gap-1.5"
                    >
                      <Repeat className="size-3.5" />
                      Recurring
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-create this task on a schedule.
                    </p>
                  </div>
                  <Switch
                    id="recurring"
                    checked={recurring}
                    onCheckedChange={setRecurring}
                  />
                </div>

                {recurring ? (
                  <div className="space-y-2">
                    <Label htmlFor="freq">Repeats</Label>
                    <Select value={freq} onValueChange={setFreq}>
                      <SelectTrigger id="freq" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_FREQS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {RECURRENCE_META[f].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isDraft ? (
                      <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        Assign someone above to activate — a recurring task needs
                        a person to remind.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {RECURRENCE_META[freq].help} A fresh task is created each
                        time and is due that day, and assignees are emailed.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due date</Label>
                    <DateTimePicker
                      id="dueDate"
                      value={dueDate}
                      onChange={setDueDate}
                      placeholder="No due date"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isDraft ? "Save draft" : "Create task"}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/tasks">Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
