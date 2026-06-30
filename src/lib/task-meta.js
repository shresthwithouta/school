/**
 * Task metadata — pure data + helpers, safe to import in client components.
 * (The data layer in `lib/tasks.ts` uses the filesystem and is server-only.)
 */

/** Task-level statuses (used for badges and the status filter). */
export const TASK_STATUSES = [
  "draft",
  "assigned",
  "in_progress",
  "in_review",
  "delayed",
  "completed",
  "cancelled",
] ;

/** Statuses a single assignee can hold. */
export const ASSIGNEE_STATUSES = [
  "assigned",
  "in_progress",
  "submitted",
  "completed",
] ;

export const STATUS_META


 = {
  draft: {
    label: "Draft",
    description: "Not assigned to anyone yet.",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
  assigned: {
    label: "Assigned",
    description: "Assigned, not started yet.",
    badgeClass:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  in_progress: {
    label: "In progress",
    description: "Being worked on.",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  in_review: {
    label: "In review",
    description: "Submitted for review, awaiting approval.",
    badgeClass:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  delayed: {
    label: "Delayed",
    description: "Past its due date and not yet completed.",
    badgeClass:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  completed: {
    label: "Completed",
    description: "All work is done.",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    description: "This task was cancelled.",
    badgeClass:
      "border-border bg-muted text-muted-foreground line-through",
  },
  // Per-assignee: submitted their part for review, awaiting approval.
  submitted: {
    label: "Submitted",
    description: "Submitted for review, awaiting approval.",
    badgeClass:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  // ── Legacy assignee status kept so old data still renders ──
  accepted: {
    label: "Accepted",
    badgeClass:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  },
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] ;
 

export const PRIORITY_META


 = {
  low: {
    label: "Low",
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  medium: {
    label: "Medium",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  high: {
    label: "High",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  urgent: {
    label: "Urgent",
    badgeClass:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
};

// ── Subtasks (one level deep) ──────────────────────────────────────
// Like tasks, a subtask is submitted for review before it can be closed: the
// assignee moves it todo → in_progress → submitted, and only the subtask's
// creator approves it (→ done) or sends it back (→ in_progress).
export const SUBTASK_STATUSES = ["todo", "in_progress", "submitted", "done"] ;
 

export const SUBTASK_STATUS_META


 = {
  todo: {
    label: "To do",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In progress",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  submitted: {
    label: "In review",
    badgeClass:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  done: {
    label: "Done",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

/** Workflow actions a user can take on a task. */


export const ACTION_META = {
  start: { label: "Start work" },
  submit: { label: "Submit for review" },
  approve: { label: "Approve" },
  sendback: { label: "Send back" },
  cancel: { label: "Cancel task" },
  reopen: { label: "Reopen" },
};

/**
 * Actions an assignee can take on their OWN per-person status. Assignees can no
 * longer close their own work — they submit it for review and the task creator
 * (or a manager) approves it. Approve / send back are reviewer actions and are
 * gated separately (see canReviewTask in lib/task-access.js).
 */
export function assigneeActions(status) {
  switch (status) {
    case "assigned":
      return ["start", "submit"];
    case "accepted": // legacy
    case "in_progress":
      return ["submit"];
    default:
      return [];
  }
}
