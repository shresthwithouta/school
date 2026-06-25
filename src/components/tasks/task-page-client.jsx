"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Star,
  Trash2,
  Pencil,
  Send,
  Check,
  X,
  Play,
  ThumbsUp,
  MessageSquare,
  History,
  Plus,
  ListTree,
  UserPlus,
  Paperclip,
} from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/tasks/task-badges";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { UserCombobox, } from "@/components/tasks/user-combobox";
import { CommentThread } from "@/components/tasks/comment-thread";
import { RichText } from "@/components/rich-text";
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import {
  assigneeActions,
  canEditProgress,
  SUBTASK_STATUSES,
  SUBTASK_STATUS_META,
} from "@/lib/task-meta";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";




function Stars({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star
            className={cn(
              "size-6 transition-colors",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 hover:text-amber-400"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function MiniStars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3",
            n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

export function TaskPageClient({
  task,
  assignees,
  currentUser,
}



) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [ratings, setRatings] = useState({ timeliness: 0, quality: 0, accuracy: 0 });
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [newSub, setNewSub] = useState("");

  const mine = task.assignees.find((a) => a.id === currentUser.id) ?? null;
  const canReview =
    currentUser.id === task.assignerId || currentUser.tier === "OWNER";
  // Only the creator can edit/delete the task and manage subtasks/assignees.
  const canEdit = currentUser.id === task.assignerId;
  const myActions = assigneeActions(mine?.status ?? null);
  const myProgress = progress ?? mine?.progress ?? 0;

  async function api(
    url,
    method,
    body,
    key = "x"
  ) {
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

  const act = (action, payload = {}, key) =>
    api(`/api/tasks/${task.id}/transition`, "POST", { action, ...payload }, key ?? action);

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

  // Assignee add/remove (manager) — reconciled server-side, preserves progress.
  function setAssignees(ids) {
    api(`/api/tasks/${task.id}`, "PATCH", { assigneeIds: ids }, "assignees");
  }

  // Subtask helpers
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
  const patchSubtask = (subId, body) =>
    api(`/api/tasks/${task.id}/subtasks/${subId}`, "PATCH", body, `sub-${subId}`);
  const removeSubtask = (subId) =>
    api(`/api/tasks/${task.id}/subtasks/${subId}`, "DELETE", undefined, `del-${subId}`);

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
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.overdue && <OverdueBadge />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        </div>
        {canEdit && task.status !== "completed" && (
          <div className="flex shrink-0 flex-wrap gap-2">
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
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* My part */}
          {mine && task.status !== "completed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your part</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myActions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {myActions.includes("accept") && (
                      <Button onClick={() => act("accept")} disabled={!!busy}>
                        {busy === "accept" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Accept
                      </Button>
                    )}
                    {myActions.includes("start") && (
                      <Button variant="outline" onClick={() => act("start")} disabled={!!busy}>
                        <Play className="size-4" />
                        Start work
                      </Button>
                    )}
                    {myActions.includes("submit") && (
                      <Button onClick={() => act("submit")} disabled={!!busy}>
                        <Send className="size-4" />
                        Submit for review
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {mine.status === "submitted"
                      ? "Submitted — waiting for review."
                      : "Nothing to do right now."}
                  </p>
                )}
                {canEditProgress(mine.status) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={myProgress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="w-10 text-right text-sm text-muted-foreground">
                      {myProgress}%
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === "progress"}
                      onClick={() => act("progress", { progress: myProgress })}
                    >
                      {busy === "progress" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                <p className="text-sm text-muted-foreground">No subtasks yet.</p>
              )}
              <ul className="space-y-2">
                {task.subtasks.map((s) => (
                  <SubtaskRow
                    key={s.id}
                    sub={s}
                    canEdit={canEdit}
                    currentUserId={currentUser.id}
                    assignees={assignees}
                    busy={busy}
                    onStatus={(status) => patchSubtask(s.id, { status })}
                    onAssignee={(assigneeId) => patchSubtask(s.id, { assigneeId })}
                    onDate={(expectedDate) => patchSubtask(s.id, { expectedDate })}
                    onDelete={() => removeSubtask(s.id)}
                  />
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

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4" />
                Comments & feedback
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
              <Detail label="Assigned by" value={task.assignerName} sub={task.assignerRole} />
              <Detail
                label="Due date"
                value={formatDate(task.dueDate)}
                danger={task.overdue}
              />
              <Detail label="Created" value={formatDate(task.createdAt)} />
              <div>
                <p className="text-xs text-muted-foreground">Overall progress</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{task.progress}%</span>
                </div>
              </div>
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
              <ul className="space-y-3">
                {task.assignees.map((a) => {
                  const reviewable = canReview && a.status === "submitted";
                  return (
                    <li key={a.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
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
                          <p className="truncate text-xs text-muted-foreground">
                            {a.role}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
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
                      </div>
                      {a.evaluation && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            T <MiniStars value={a.evaluation.timeliness} />
                          </span>
                          <span className="inline-flex items-center gap-1">
                            Q <MiniStars value={a.evaluation.quality} />
                          </span>
                          <span className="inline-flex items-center gap-1">
                            A <MiniStars value={a.evaluation.accuracy} />
                          </span>
                          <span className="font-medium text-foreground">
                            {a.evaluation.average}/5
                          </span>
                        </div>
                      )}
                      {reviewable && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setApproveTarget(a);
                              setRatings({ timeliness: 0, quality: 0, accuracy: 0 });
                              setNote("");
                            }}
                            disabled={!!busy}
                          >
                            <ThumbsUp className="size-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget(a);
                              setFeedback("");
                            }}
                            disabled={!!busy}
                          >
                            <X className="size-4" />
                            Changes
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {canEdit && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Add people
                  </p>
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

      {/* Approve dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & evaluate</DialogTitle>
            <DialogDescription>
              Rate {approveTarget?.name}&apos;s work on the three criteria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(["timeliness", "quality", "accuracy"] ).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{k}</span>
                <Stars value={ratings[k]} onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))} />
              </div>
            ))}
            <Textarea
              rows={2}
              placeholder="Optional note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={
                !!busy || !ratings.timeliness || !ratings.quality || !ratings.accuracy
              }
              onClick={async () => {
                const ok = await act(
                  "approve",
                  { assigneeId: approveTarget?.id, evaluation: ratings, note },
                  "approve"
                );
                if (ok) {
                  setApproveTarget(null);
                  toast.success("Approved & completed");
                }
              }}
            >
              {busy === "approve" && <Loader2 className="size-4 animate-spin" />}
              Approve & complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              {rejectTarget?.name}&apos;s task returns to in-progress with your feedback.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="What needs to change?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!!busy || !feedback.trim()}
              onClick={async () => {
                const ok = await act(
                  "reject",
                  { assigneeId: rejectTarget?.id, feedback },
                  "reject"
                );
                if (ok) {
                  setRejectTarget(null);
                  toast.success("Sent back for changes");
                }
              }}
            >
              {busy === "reject" && <Loader2 className="size-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({
  label,
  value,
  sub,
  danger,
}




) {
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

function SubtaskRow({
  sub,
  canEdit,
  currentUserId,
  assignees,
  busy,
  onStatus,
  onAssignee,
  onDate,
  onDelete,
}









) {
  const canStatus = canEdit || sub.assigneeId === currentUserId;
  return (
    <li className="rounded-lg border p-2.5">
      <div className="flex items-center gap-2">
        {canStatus ? (
          <Select value={sub.status} onValueChange={onStatus}>
            <SelectTrigger size="sm" className="w-32 shrink-0">
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
        ) : (
          <Badge variant="outline" className={SUBTASK_STATUS_META[sub.status].badgeClass}>
            {SUBTASK_STATUS_META[sub.status].label}
          </Badge>
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            sub.status === "done" && "text-muted-foreground line-through"
          )}
        >
          {sub.title}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={!!busy}
            className="text-muted-foreground hover:text-destructive"
            title="Delete subtask"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-1 text-xs text-muted-foreground">
        {canEdit ? (
          <>
            <Select
              value={sub.assigneeId ?? "none"}
              onValueChange={(v) => onAssignee(v === "none" ? "" : v)}
            >
              <SelectTrigger size="sm" className="h-7 w-40">
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
            <Input
              type="date"
              defaultValue={sub.expectedDate ? sub.expectedDate.slice(0, 10) : ""}
              onChange={(e) => onDate(e.target.value)}
              className="h-7 w-36"
            />
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <Avatar className="size-4">
                <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                  {sub.assigneeName ? getInitials(sub.assigneeName) : "—"}
                </AvatarFallback>
              </Avatar>
              {sub.assigneeName || "Unassigned"}
            </span>
            {sub.expectedDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDate(sub.expectedDate)}
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}
