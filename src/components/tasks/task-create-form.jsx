"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, X } from "lucide-react";

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
import { AttachmentUploader } from "@/components/attachments";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";

export function TaskCreateForm({ assignees, currentUserId }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);

  const isDraft = selected.length === 0;
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
        dueDate,
        attachments,
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

          <div className="space-y-2">
            <Label>
              Attachments{" "}
              <span className="text-muted-foreground">(files or a voice note)</span>
            </Label>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <span
                    key={`${a.publicId}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2 py-1 text-xs"
                  >
                    <Paperclip className="size-3" />
                    <span className="max-w-40 truncate">{a.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((p) => p.filter((_, idx) => idx !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <AttachmentUploader
              onAdd={(a) => setAttachments((p) => [...p, a])}
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

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="dueDate">Due date</Label>
                <DateTimePicker
                  id="dueDate"
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="No due date"
                />
                <p className="text-xs text-muted-foreground">
                  Need something done every day?{" "}
                  <Link href="/recurring/new" className="text-primary hover:underline">
                    Create a recurring task
                  </Link>{" "}
                  instead.
                </p>
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
