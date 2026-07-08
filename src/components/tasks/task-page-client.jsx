"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  MessageSquare,
  History,
  Plus,
  ListTree,
  ClipboardList,
  UserPlus,
  ChevronDown,
  Send,
  Check,
  Undo2,
  Lock,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StatusBadge,
  PriorityBadge,
  RecurringBadge,
} from "@/components/tasks/task-badges";
import { StatusSelect } from "@/components/tasks/status-select";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { SubtaskDialog } from "@/components/tasks/subtask-dialog";
import { SubmitReviewDialog } from "@/components/tasks/submit-review-dialog";
import { SendBackDialog } from "@/components/tasks/send-back-dialog";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { CommentThread } from "@/components/tasks/comment-thread";
import { RichText } from "@/components/rich-text";
import { AttachmentList } from "@/components/attachments";
import { SUBTASK_STATUS_META } from "@/lib/task-meta";
import {
  cn,
  formatDate,
  formatDateTime,
  formatDateMaybeTime,
  getInitials,
  toPlainText,
} from "@/lib/utils";

const ACTIVITY_PAGE_SIZE = 6;

export function TaskPageClient({ task, assignees, currentUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  // Refresh after a mutation inside a transition so it never blocks the UI.
  const [, startTransition] = useTransition();
  // Dedicated busy state for the status switcher so it can show feedback the
  // instant an option is picked (the server round-trip + refresh is slow).
  const [statusSending, setStatusSending] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();
  const statusBusy = statusSending || statusPending;
  // Description is collapsible (toggled via the chevron) so a long write-up
  // doesn't push subtasks/comments below the fold.
  const [descOpen, setDescOpen] = useState(true);
  // Activity log can grow long over a task's lifetime — collapsed to the
  // most recent entries by default, expandable via "See all".
  const [showAllActivity, setShowAllActivity] = useState(false);

  const mine = task.assignees.find((a) => a.id === currentUser.id) ?? null;
  const isManager = currentUser.tier === "OWNER" || currentUser.tier === "ADMIN";
  // Only an Admin (Owner tier) can save a file into the repository.
  const isChairman = currentUser.tier === "OWNER";
  const [savingId, setSavingId] = useState(null);
  // Only the creator (assigner) or a manager (Admin/Manager) may edit the task
  // itself (title, description, priority, due date). Mirrors canEdit server-side.
  const canEdit = currentUser.id === task.assignerId || isManager;
  // The creator can delete their own task; an Admin (Owner tier) can
  // delete any task. Mirrors canDeleteTask in lib/tasks.js.
  const canDelete = canEdit || currentUser.tier === "OWNER";
  // Anyone collaborating on the task (creator, an assignee, or a manager) can
  // drive its workflow and add subtasks — not just the creator.
  const involved = canEdit || isManager || !!mine;
  const canControl = involved;
  // The task creator or a manager reviews submissions (approve / send back).
  const canReview = canEdit || isManager;
  const isClosed = task.status === "completed" || task.status === "cancelled";
  // An assignee submits their part for review (with a note) when it's still open.
  const canSubmit = !isClosed && !!mine && (mine.status === "assigned" || mine.status === "in_progress");

  // Jira-style status switcher options (each maps to a transition action). A
  // closed task only offers Reopen; an open one offers the work transitions.
  // Assignees no longer close their own work — that's the "Submit for review"
  // button (it needs a note, so it's a dialog rather than a plain option).
  const statusOptions = [];
  if (isClosed) {
    if (canControl) statusOptions.push({ value: "reopen", label: "Reopen" });
  } else {
    if (mine && mine.status === "assigned")
      statusOptions.push({ value: "start", label: "In progress" });
    if (canControl) statusOptions.push({ value: "cancel", label: "Cancelled" });
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
    startTransition(() => router.refresh());
    return true;
  }

  // Status switcher: each option maps to a workflow transition. Runs with its
  // own busy state + transition so the dropdown reacts immediately and the
  // refresh never blocks the page.
  async function changeStatus(action) {
    setStatusSending(true);
    const res = await fetch(`/api/tasks/${task.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setStatusSending(false);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong");
      return;
    }
    startStatusTransition(() => router.refresh());
  }

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

  // Chairman-only: copy a submitted file into the central repository.
  async function saveToRepo(a) {
    setSavingId(a.id);
    const res = await fetch("/api/repository", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: a.url,
        publicId: a.publicId,
        resourceType: a.resourceType,
        format: a.format,
        bytes: a.bytes,
        name: a.name,
        kind: a.kind,
        sourceType: "task",
        sourceId: task.id,
        sourceTitle: task.title,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save to repository");
      return;
    }
    toast.success("Saved to repository");
  }

  const assigneeIds = task.assignees.map((a) => a.id);
  const doneSubs = task.subtasks.filter((s) => s.status === "done").length;
  const subPct = task.subtasks.length
    ? Math.round((doneSubs / task.subtasks.length) * 100)
    : 0;
  const doneAssignees = task.assignees.filter((a) => a.status === "completed").length;

  // People who can be @mentioned in a comment: the task creator and its
  // assignees (deduped). When the creator mentions someone the comment is
  // private — the comment editor warns and enforces a 50-char minimum.
  const participants = [
    { id: task.assignerId, name: task.assignerName, role: task.assignerRole },
    ...task.assignees.map((a) => ({ id: a.id, name: a.name, role: a.role })),
  ].filter((p, i, arr) => p.id && arr.findIndex((x) => x.id === p.id) === i);

  return (
    <div className="min-w-0 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/tasks">
          <ArrowLeft className="size-4" />
          Back to tasks
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{task.key}</span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <RecurringBadge recurrence={task.recurrence} />
            {task.delayed && task.daysLate > 0 && (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {task.daysLate} day{task.daysLate === 1 ? "" : "s"} late
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
          <AssigneeRow assignees={task.assignees} />
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
          {canDelete && (
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

      {/* Mobile-only quick actions: status switcher + submit for review,
          surfaced right under the header so they're not buried below the
          fold behind description/subtasks/comments on small screens. Mirrors
          the "Status" block in the sidebar Details card (hidden on mobile
          there to avoid duplication). */}
      <div className="rounded-lg border p-3 lg:hidden">
        <p className="mb-1.5 text-xs text-muted-foreground">Status</p>
        {statusOptions.length > 0 ? (
          <StatusSelect
            status={task.status}
            options={statusOptions}
            busy={statusBusy}
            onSelect={changeStatus}
          />
        ) : (
          <StatusBadge status={task.status} />
        )}
        {canSubmit && (
          <SubmitReviewDialog
            taskId={task.id}
            trigger={
              <Button size="sm" className="mt-2 w-full">
                <Send className="size-4" />
                Submit for review
              </Button>
            }
          />
        )}
        {mine && mine.status === "submitted" && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
            <Lock className="size-3.5" />
            Submitted — awaiting review
          </p>
        )}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Description — collapsible so a long write-up doesn't bury the
              subtasks/comments below it. Any general reference files added
              while creating/editing the task show here, read-only. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setDescOpen((o) => !o)}
                  title={descOpen ? "Collapse" : "Expand"}
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform", !descOpen && "-rotate-90")}
                  />
                </Button>
              </CardAction>
            </CardHeader>
            {descOpen && (
              <CardContent className="space-y-4">
                {task.description ? (
                  <RichText html={task.description} className="text-muted-foreground" />
                ) : (
                  <p className="text-sm text-muted-foreground">No description.</p>
                )}
                {task.attachments.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Files ({task.attachments.length})
                    </p>
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
                      onSave={isChairman ? saveToRepo : undefined}
                      savingId={savingId}
                    />
                  </div>
                )}
              </CardContent>
            )}
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
              {task.subtasks.length > 0 && (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Subtask</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expected</TableHead>
                        {involved && (
                          <TableHead className="w-10 text-right">Edit</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {task.subtasks.map((s) => {
                        const desc = toPlainText(s.description || "");
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="max-w-[20rem] whitespace-normal align-top">
                              <Link
                                href={`/tasks/${task.key}/${s.key}`}
                                className="group/st block"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {s.key}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-sm font-medium group-hover/st:underline",
                                      s.status === "done" &&
                                        "text-muted-foreground line-through"
                                    )}
                                  >
                                    {s.title}
                                  </span>
                                </span>
                                {desc && (
                                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {desc}
                                  </span>
                                )}
                              </Link>
                            </TableCell>
                            <TableCell className="align-top">
                              {s.assigneeName ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Avatar className="size-5">
                                    <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                                      {getInitials(s.assigneeName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{s.assigneeName}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Unassigned
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <PriorityBadge priority={s.priority || "medium"} />
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge
                                variant="outline"
                                className={SUBTASK_STATUS_META[s.status].badgeClass}
                              >
                                {SUBTASK_STATUS_META[s.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              {s.expectedDate ? (
                                <span
                                  className={cn(
                                    "text-sm",
                                    s.overdue &&
                                      "font-medium text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {formatDate(s.expectedDate)}
                                  {s.overdue && (
                                    <span className="block text-[10px] font-medium">
                                      overdue
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            {involved && (
                              <TableCell className="align-top text-right">
                                <SubtaskDialog
                                  task={{ id: task.id, key: task.key }}
                                  sub={s}
                                  assignees={assignees}
                                  currentUserId={currentUser.id}
                                  canEditDate={
                                    isManager ||
                                    currentUser.id === (s.createdById || task.assignerId)
                                  }
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Edit subtask"
                                      className="size-8 text-muted-foreground hover:text-foreground"
                                    >
                                      <Pencil className="size-4" />
                                    </Button>
                                  }
                                />
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {involved && (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/tasks/${task.key}/subtasks/new`}>
                    <Plus className="size-4" />
                    New subtask
                  </Link>
                </Button>
              )}
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
              <CommentThread
                taskId={task.id}
                comments={task.comments}
                participants={participants}
                currentUser={currentUser}
                isCreator={canEdit}
                onSaveAttachment={isChairman ? saveToRepo : undefined}
                savingAttachmentId={savingId}
              />
            </CardContent>
          </Card>

          {/* Summary — every key detail of the task at a glance, in one table. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-4" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableBody>
                    <SummaryRow label="Task">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {task.key}
                        </span>
                        <span className="font-medium">{task.title}</span>
                      </span>
                    </SummaryRow>
                    <SummaryRow label="Status">
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} />
                        {task.delayed && task.daysLate > 0 && (
                          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            {task.daysLate} day{task.daysLate === 1 ? "" : "s"} late
                          </span>
                        )}
                      </span>
                    </SummaryRow>
                    <SummaryRow label="Priority">
                      <PriorityBadge priority={task.priority} />
                    </SummaryRow>
                    <SummaryRow label="Repeats">
                      {task.recurrence?.freq ? (
                        <RecurringBadge recurrence={task.recurrence} />
                      ) : (
                        <span className="text-muted-foreground">Doesn&apos;t repeat</span>
                      )}
                    </SummaryRow>
                    <SummaryRow label="Assigned by">
                      <span className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                            {getInitials(task.assignerName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          <span className="font-medium">{task.assignerName}</span>
                          {task.assignerRole && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {task.assignerRole}
                            </span>
                          )}
                        </span>
                      </span>
                    </SummaryRow>
                    <SummaryRow label={`Assignees (${task.assignees.length})`}>
                      {task.assignees.length === 0 ? (
                        <span className="text-muted-foreground">
                          Draft — no one assigned yet
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {task.assignees.map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
                            >
                              <Avatar className="size-4">
                                <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                                  {getInitials(a.name)}
                                </AvatarFallback>
                              </Avatar>
                              {a.name}
                              {a.status === "completed" && (
                                <CheckCircle2 className="size-3 text-emerald-500" />
                              )}
                            </span>
                          ))}
                        </span>
                      )}
                    </SummaryRow>
                    <SummaryRow label="Due date">
                      <span
                        className={cn(
                          task.delayed && "font-medium text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {task.dueDate ? formatDateMaybeTime(task.dueDate) : "—"}
                      </span>
                    </SummaryRow>
                    <SummaryRow label="Progress">
                      {task.assignees.length > 0 ? (
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {doneAssignees}
                          </span>{" "}
                          of {task.assignees.length} assignee
                          {task.assignees.length === 1 ? "" : "s"} approved
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </SummaryRow>
                    <SummaryRow label="Subtasks">
                      {task.subtasks.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span
                            className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={subPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span
                              className="block h-full rounded-full bg-emerald-500"
                              style={{ width: `${subPct}%` }}
                            />
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {doneSubs}/{task.subtasks.length} done
                          </span>
                        </span>
                      )}
                    </SummaryRow>
                    <SummaryRow label="Created">
                      {formatDateTime(task.createdAt)}
                    </SummaryRow>
                  </TableBody>
                </Table>
              </div>
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
              <div className="hidden lg:block">
                <p className="mb-1.5 text-xs text-muted-foreground">Status</p>
                {statusOptions.length > 0 ? (
                  <StatusSelect
                    status={task.status}
                    options={statusOptions}
                    busy={statusBusy}
                    onSelect={changeStatus}
                  />
                ) : (
                  <StatusBadge status={task.status} />
                )}
                {canSubmit && (
                  <SubmitReviewDialog
                    taskId={task.id}
                    trigger={
                      <Button size="sm" className="mt-2 w-full">
                        <Send className="size-4" />
                        Submit for review
                      </Button>
                    }
                  />
                )}
                {mine && mine.status === "submitted" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                    <Lock className="size-3.5" />
                    Submitted — awaiting review
                  </p>
                )}
              </div>
              <Detail label="Assigned by" value={task.assignerName} sub={task.assignerRole} />
              <Detail
                label="Due date"
                value={task.dueDate ? formatDateMaybeTime(task.dueDate) : "—"}
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
                      </div>
                      {reviewable && (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <p className="text-xs text-muted-foreground">
                            {a.name} submitted their work for review.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={!!busy}
                              onClick={() =>
                                api(
                                  `/api/tasks/${task.id}/transition`,
                                  "POST",
                                  { action: "approve", assigneeId: a.id },
                                  "review"
                                )
                              }
                            >
                              <Check className="size-4" />
                              Approve
                            </Button>
                            <SendBackDialog
                              taskId={task.id}
                              assignee={a}
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-amber-600 dark:text-amber-400"
                                  disabled={!!busy}
                                >
                                  <Undo2 className="size-4" />
                                  Send back
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
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
        </div>
      </div>

      {/* Activity — full-width at the very bottom, on both mobile and desktop. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const allActivity = [...task.activity].reverse();
            const visibleActivity = showAllActivity
              ? allActivity
              : allActivity.slice(0, ACTIVITY_PAGE_SIZE);
            return (
              <>
                <ol className="space-y-3 border-l pl-4">
                  {visibleActivity.map((a) => (
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
                {allActivity.length > ACTIVITY_PAGE_SIZE && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-muted-foreground"
                    onClick={() => setShowAllActivity((v) => !v)}
                  >
                    {showAllActivity
                      ? "Show less"
                      : `See all activity (${allActivity.length})`}
                  </Button>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// Compact single-row assignee glance under the task title: first two people by
// name, the rest folded into a "+N more" popover so the header never wraps
// into multiple lines. Full management (add/remove/approve) stays in the
// sidebar Assignees card — this is read-only.
function AssigneeRow({ assignees }) {
  if (assignees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Draft — no one assigned yet</p>
    );
  }
  const shown = assignees.slice(0, 2);
  const rest = assignees.slice(2);
  return (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden text-sm">
      <span className="shrink-0 text-muted-foreground">Assigned to</span>
      {shown.map((a) => (
        <span
          key={a.id}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
        >
          <Avatar className="size-4">
            <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
              {getInitials(a.name)}
            </AvatarFallback>
          </Avatar>
          {a.name}
          {a.status === "completed" && (
            <CheckCircle2 className="size-3 text-emerald-500" />
          )}
        </span>
      ))}
      {rest.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              +{rest.length} more
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              All assignees ({assignees.length})
            </p>
            <ul className="space-y-1.5">
              {assignees.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Avatar className="size-5">
                    <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                      {getInitials(a.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.status === "completed" && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  )}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// One row of the task Summary table: a muted label cell + a value cell that can
// hold badges, avatars or plain text. Values wrap; labels stay on one line.
function SummaryRow({ label, children }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="w-40 whitespace-nowrap py-2.5 align-top text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </TableCell>
      <TableCell className="whitespace-normal py-2.5 align-top text-sm">
        {children}
      </TableCell>
    </TableRow>
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
