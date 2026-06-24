"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
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
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/tasks/task-badges";
import { TaskDialog, type AssignableUser } from "@/components/tasks/task-dialog";
import { assigneeActions, canEditProgress } from "@/lib/task-meta";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";
import type { Assignee, TaskDTO } from "@/lib/tasks";

type CurrentUser = { id: string; role: string; tier: string };

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

function MiniStars({ value }: { value: number }) {
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

export function TaskDetail({
  task,
  open,
  onOpenChange,
  currentUser,
  assignees,
}: {
  task: TaskDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUser: CurrentUser;
  assignees: AssignableUser[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<Assignee | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Assignee | null>(null);
  const [ratings, setRatings] = useState({ timeliness: 0, quality: 0, accuracy: 0 });
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  if (!task) return null;

  const mine = task.assignees.find((a) => a.id === currentUser.id) ?? null;
  const canReview =
    currentUser.id === task.assignerId || currentUser.tier === "OWNER";
  const canEdit = canReview;
  const myActions = assigneeActions(mine?.status ?? null);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (!task) return false;
    setBusy(`${action}:${(payload.assigneeId as string) ?? "me"}`);
    const res = await fetch(`/api/tasks/${task.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Action failed");
      return false;
    }
    router.refresh();
    return true;
  }

  async function submitComment() {
    if (!task || !comment.trim()) return;
    setBusy("comment");
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: comment }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not add comment");
      return;
    }
    setComment("");
    router.refresh();
  }

  async function onDelete() {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete task");
      return;
    }
    toast.success("Task deleted");
    onOpenChange(false);
    router.refresh();
  }

  const myProgress = progress ?? mine?.progress ?? 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="space-y-3 border-b">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.overdue && <OverdueBadge />}
            </div>
            <SheetTitle className="text-xl leading-tight">{task.title}</SheetTitle>
            <SheetDescription className="sr-only">Task details</SheetDescription>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Assigned by</p>
                <p className="font-medium">{task.assignerName}</p>
                <p className="text-xs text-muted-foreground">{task.assignerRole}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due date</p>
                <p className="inline-flex items-center gap-1.5 font-medium">
                  <CalendarDays className="size-3.5" />
                  {formatDate(task.dueDate)}
                </p>
              </div>
            </div>

            {canEdit && task.status !== "completed" && (
              <div className="flex flex-wrap gap-2">
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
                        This permanently removes &quot;{task.title}&quot; and its
                        history. This cannot be undone.
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
          </SheetHeader>

          <div className="space-y-6 p-4">
            {task.description && (
              <section>
                <h4 className="mb-1.5 text-sm font-medium">Description</h4>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {task.description}
                </p>
              </section>
            )}

            {/* My actions */}
            {mine && task.status !== "completed" && (
              <section className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Your part</p>
                {myActions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {myActions.includes("accept") && (
                      <Button onClick={() => act("accept")} disabled={!!busy}>
                        {busy === "accept:me" ? (
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
                      disabled={busy === "progress:me"}
                      onClick={() => act("progress", { progress: myProgress })}
                    >
                      {busy === "progress:me" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Assignees */}
            <section className="space-y-3">
              <h4 className="text-sm font-medium">
                Assignees ({task.assignees.length})
              </h4>
              <ul className="space-y-3">
                {task.assignees.map((a) => {
                  const isMe = a.id === currentUser.id;
                  const reviewable = canReview && a.status === "submitted";
                  return (
                    <li key={a.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(a.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {a.name}
                            {isMe && (
                              <span className="text-muted-foreground"> (you)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.role}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${a.status === "completed" ? 100 : a.progress}%`,
                          }}
                        />
                      </div>

                      {a.evaluation && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            Timeliness <MiniStars value={a.evaluation.timeliness} />
                          </span>
                          <span className="inline-flex items-center gap-1">
                            Quality <MiniStars value={a.evaluation.quality} />
                          </span>
                          <span className="inline-flex items-center gap-1">
                            Accuracy <MiniStars value={a.evaluation.accuracy} />
                          </span>
                          <span className="font-medium text-foreground">
                            avg {a.evaluation.average}/5
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
                            Request changes
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <Separator />

            {/* Comments */}
            <section className="space-y-3">
              <h4 className="flex items-center gap-1.5 text-sm font-medium">
                <MessageSquare className="size-4" />
                Comments & feedback
              </h4>
              {task.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {task.comments.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {getInitials(c.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "flex-1 rounded-lg border p-2.5",
                          c.kind === "feedback" &&
                            "border-amber-500/30 bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {c.authorName}
                            {c.kind === "feedback" && (
                              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                                feedback
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {c.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-start gap-2">
                <Textarea
                  rows={2}
                  placeholder="Write a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  size="icon"
                  onClick={submitComment}
                  disabled={busy === "comment" || !comment.trim()}
                >
                  {busy === "comment" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </section>

            <Separator />

            {/* Activity */}
            <section className="space-y-3">
              <h4 className="flex items-center gap-1.5 text-sm font-medium">
                <History className="size-4" />
                Activity
              </h4>
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
            </section>
          </div>
        </SheetContent>
      </Sheet>

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
            {(["timeliness", "quality", "accuracy"] as const).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{k}</span>
                <Stars
                  value={ratings[k]}
                  onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))}
                />
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
                !!busy ||
                !ratings.timeliness ||
                !ratings.quality ||
                !ratings.accuracy
              }
              onClick={async () => {
                const ok = await act("approve", {
                  assigneeId: approveTarget?.id,
                  evaluation: ratings,
                  note,
                });
                if (ok) {
                  setApproveTarget(null);
                  toast.success("Approved & completed");
                }
              }}
            >
              {busy?.startsWith("approve") && <Loader2 className="size-4 animate-spin" />}
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
              {rejectTarget?.name}&apos;s task returns to in-progress with your
              feedback.
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
                const ok = await act("reject", {
                  assigneeId: rejectTarget?.id,
                  feedback,
                });
                if (ok) {
                  setRejectTarget(null);
                  toast.success("Sent back for changes");
                }
              }}
            >
              {busy?.startsWith("reject") && <Loader2 className="size-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
