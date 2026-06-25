"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, ChevronRight } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUBTASK_STATUSES, SUBTASK_STATUS_META } from "@/lib/task-meta";

export function SubtaskPageClient({ task, sub, assignees, canEdit, currentUserId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(sub.title);

  const canStatus = canEdit || sub.assigneeId === currentUserId;
  const base = `/api/tasks/${task.id}/subtasks/${sub.id}`;

  async function patch(body, successMsg) {
    setBusy(true);
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not update subtask");
      return;
    }
    if (successMsg) toast.success(successMsg);
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    const res = await fetch(base, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not delete subtask");
      return;
    }
    toast.success("Subtask deleted");
    router.push(`/tasks/${task.key}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/tasks/${task.key}`}>
          <ArrowLeft className="size-4" />
          Back to {task.key}
        </Link>
      </Button>

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/tasks/${task.key}`} className="hover:text-foreground">
          {task.key} {task.title}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-mono">{sub.key}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{sub.key}</span>
            <Badge variant="outline" className={SUBTASK_STATUS_META[sub.status].badgeClass}>
              {SUBTASK_STATUS_META[sub.status].label}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{sub.title}</h1>
        </div>
        {canEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this subtask?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes &quot;{sub.title}&quot; from {task.key}. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Subtask</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-title">Title</Label>
              <div className="flex gap-2">
                <Input
                  id="sub-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <Button
                    variant="outline"
                    disabled={busy || title.trim().length < 2 || title === sub.title}
                    onClick={() => patch({ title }, "Title updated")}
                  >
                    Save
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={sub.status}
                onValueChange={(v) => patch({ status: v })}
                disabled={!canStatus || busy}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBTASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUBTASK_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              {canEdit ? (
                <Select
                  value={sub.assigneeId ?? "none"}
                  onValueChange={(v) => patch({ assigneeId: v === "none" ? "" : v })}
                  disabled={busy}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {assignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{sub.assigneeName || "Unassigned"}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected date</Label>
              {canEdit ? (
                <Input
                  type="date"
                  defaultValue={sub.expectedDate ? sub.expectedDate.slice(0, 10) : ""}
                  onChange={(e) => patch({ expectedDate: e.target.value })}
                  disabled={busy}
                />
              ) : (
                <p className="font-medium">
                  {sub.expectedDate ? sub.expectedDate.slice(0, 10) : "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
