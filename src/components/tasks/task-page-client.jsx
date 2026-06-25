"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Pencil,
  X,
  Ban,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  MessageSquare,
  History,
  Plus,
  ListTree,
  UserPlus,
  Paperclip,
} from "lucide-react";

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
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { CommentThread } from "@/components/tasks/comment-thread";
import { RichText } from "@/components/rich-text";
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import { SUBTASK_STATUS_META } from "@/lib/task-meta";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";

export function TaskPageClient({ task, assignees, currentUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [newSub, setNewSub] = useState("");

  const mine = task.assignees.find((a) => a.id === currentUser.id) ?? null;
  const isManager = currentUser.tier === "OWNER" || currentUser.tier === "ADMIN";
  const canEdit = currentUser.id === task.assignerId;
  const canControl = canEdit || isManager;
  const isClosed = task.status === "completed" || task.status === "cancelled";

  // Jira-style status switcher options (each maps to a transition action).
  const statusOptions = [];
  if (mine && mine.status !== "completed") {
    if (mine.status !== "in_progress")
      statusOptions.push({ value: "start", label: "In progress" });
    statusOptions.push({ value: "complete", label: "Completed" });
  }
  if (canControl) {
    if (!isClosed) statusOptions.push({ value: "cancel", label: "Cancelled" });
    if (isClosed) statusOptions.push({ value: "reopen", label: "Reopen" });
  }

  async function api(url, method, body, key = "x") {
    setBusy(key);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong");
      return false;
    }
    router.refresh();
    return true;
  }

  const act = (action, key) =>
    api(`/api/tasks/${task.id}/transition`, "POST", { action }, key ?? action);

  async function onDelete() {
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not delete task");
      return;
    }
    toast.success("Task deleted");
    router.push("/tasks");
    router.refresh();
  }

  function setAssignees(ids) {
    api(`/api/tasks/${task.id}`, "PATCH", { assigneeIds: ids }, "assignees");
  }

  const addSubtask = async () => {
    if (!newSub.trim()) return;
    const ok = await api(
      `/api/tasks/${task.id}/subtasks`,
      "POST",
      { title: newSub },
      "add-sub"
    );
    if (ok) setNewSub("");
  };

  const assigneeIds = task.assignees.map((a) => a.id);
  const doneSubs = task.subtasks.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/tasks">
          <ArrowLeft className="size-4" />
          Back to tasks
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{task.key}</span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.delayed && task.daysLate > 0 && (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {task.daysLate} day{task.daysLate === 1 ? "" : "s"} late
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canEdit && !isClosed && (
            <TaskDialog
              mode="edit"
              task={task}
              assignees={assignees}
              currentUserId={currentUser.id}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" />
                  Edit
                </Button>
              }
            />
          )}
          {canControl && !isClosed && (
            <ConfirmButton
              label="Cancel"
              icon={Ban}
              title="Cancel this task?"
              description="It will be marked cancelled. You can reopen it later."
              confirmLabel="Cancel task"
              disabled={!!busy}
              onConfirm={() => act("cancel")}
            />
          )}
          {canControl && isClosed && (
            <Button
              variant="outline"
              size="sm"
              disabled={!!busy}
              onClick={() => act("reopen")}
            >
              <RotateCcw className="size-4" />
              Reopen
            </Button>
          )}
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
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes &quot;{task.title}&quot;, its subtasks
                    and history. This cannot be undone.
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <RichText html={task.description} className="text-muted-foreground" />
              ) : (
                <p className="text-sm text-muted-foreground">No description.</p>
              )}
            </CardContent>
          </Card>

          {/* Subtasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTree className="size-4" />
                Subtasks
                {task.subtasks.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {doneSubs}/{task.subtasks.length} done
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.subtasks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No subtasks. Break this task down into smaller pieces.
                </p>
              )}
              <ul className="space-y-2">
                {task.subtasks.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/tasks/${task.key}/${s.key}`}
                      className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.key}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          s.status === "done" && "text-muted-foreground line-through"
                        )}
                      >
                        {s.title}
                      </span>
                      {s.assigneeName && (
                        <Avatar className="size-6" title={s.assigneeName}>
                          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                            {getInitials(s.assigneeName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <Badge
                        variant="outline"
                        className={SUBTASK_STATUS_META[s.status].badgeClass}
                      >
                        {SUBTASK_STATUS_META[s.status].label}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>

              {canEdit && (
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Add a subtask…"
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                  />
                  <Button
                    onClick={addSubtask}
                    disabled={busy === "add-sub" || !newSub.trim()}
                  >
                    {busy === "add-sub" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="size-4" />
                Attachments
                {task.attachments.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {task.attachments.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AttachmentList
                attachments={task.attachments}
                onRemove={(attId) =>
                  api(
                    `/api/tasks/${task.id}/attachments/${attId}`,
                    "DELETE",
                    undefined,
                    "att-del"
                  )
                }
                canRemove={(a) => a.uploadedById === currentUser.id || canEdit}
              />
              <AttachmentUploader
                onAdd={(a) =>
                  api(`/api/tasks/${task.id}/attachments`, "POST", a, "att-add")
                }
              />
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread taskId={task.id} comments={task.comments} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Status</p>
                {statusOptions.length > 0 ? (
                  <Select onValueChange={(v) => act(v)}>
                    <SelectTrigger className="w-full">
                      <StatusBadge status={task.status} />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge status={task.status} />
                )}
              </div>
              <Detail label="Assigned by" value={task.assignerName} sub={task.assignerRole} />
              <Detail
                label="Due date"
                value={task.dueDate ? formatDate(task.dueDate) : "—"}
                danger={task.delayed}
                sub={
                  task.delayed && task.daysLate > 0
                    ? `${task.daysLate} day${task.daysLate === 1 ? "" : "s"} late`
                    : undefined
                }
              />
              <Detail label="Created" value={formatDate(task.createdAt)} />
            </CardContent>
          </Card>

          {/* Assignees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="size-4" />
                Assignees ({task.assignees.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.assignees.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Draft — no one assigned yet.
                </p>
              )}
              <ul className="space-y-3">
                {task.assignees.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg border p-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {getInitials(a.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.name}
                        {a.id === currentUser.id && (
                          <span className="text-muted-foreground"> (you)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.role}</p>
                    </div>
                    {a.status === "completed" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <StatusBadge status={a.status} />
                    )}
                    {canEdit && a.id !== currentUser.id && (
                      <button
                        type="button"
                        title="Unassign"
                        onClick={() =>
                          setAssignees(assigneeIds.filter((x) => x !== a.id))
                        }
                        disabled={!!busy}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {canEdit && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Add people</p>
                  <UserCombobox
                    users={assignees}
                    value={assigneeIds}
                    onChange={setAssignees}
                    currentUserId={currentUser.id}
                    placeholder="Search to add…"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4">
                {[...task.activity].reverse().map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-5.25 top-1.5 size-2 rounded-full bg-primary" />
                    <p className="text-sm">
                      <span className="font-medium">{a.actorName}</span>{" "}
                      <span className="text-muted-foreground">{a.message}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConfirmButton({
  label,
  icon: Icon,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Icon className="size-4" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Detail({ label, value, sub, danger }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium", danger && "text-rose-600 dark:text-rose-400")}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
