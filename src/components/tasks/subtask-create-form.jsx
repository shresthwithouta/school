"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";

// A subtask is just a task with a parent, so this mirrors the task create
// form (same fields, same layout) — only the assignee is a single person and
// it posts to the parent task's subtasks endpoint.
export function SubtaskCreateForm({ task, assignees, currentUserId }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Single assignee, held as a 0-or-1 array so we can reuse UserCombobox.
  const [assignee, setAssignee] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [expectedDate, setExpectedDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Give the subtask a title.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        assigneeId: assignee[0] ?? "",
        priority,
        expectedDate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not create subtask");
      return;
    }
    toast.success("Subtask created");
    // The created subtask is the last one appended to the returned task.
    const subs = data.task?.subtasks ?? [];
    const created = subs[subs.length - 1];
    router.push(
      created ? `/tasks/${task.key}/${created.key}` : `/tasks/${task.key}`
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/tasks/${task.key}`}>
          <ArrowLeft className="size-4" />
          Back to {task.key}
        </Link>
      </Button>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Subtask of <span className="font-mono">{task.key}</span> · {task.title}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">New subtask</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary of the subtask"
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
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <UserCombobox
                  users={assignees}
                  value={assignee}
                  onChange={setAssignee}
                  currentUserId={currentUserId}
                  placeholder="Search a name…"
                  single
                />
                {assignee.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Unassigned — search to assign someone.
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

              <div className="space-y-2">
                <Label htmlFor="expectedDate">Expected date</Label>
                <Input
                  id="expectedDate"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create subtask
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/tasks/${task.key}`}>Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
