/**
 * Task metadata — pure data + helpers, safe to import in client components.
 * (The data layer in `lib/tasks.ts` uses the filesystem and is server-only.)
 */

/** Task-level statuses (used for badges and the status filter). */
export const TASK_STATUSES = [
  "draft",
  "assigned",
  "in_progress",
  "delayed",
  "completed",
  "cancelled",
] ;

/** Statuses a single assignee can hold. */
export const ASSIGNEE_STATUSES = ["assigned", "in_progress", "completed"] ;

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
  // ── Legacy assignee statuses kept so old data still renders ──
  accepted: {
    label: "Accepted",
    badgeClass:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  },
  submitted: {
    label: "Submitted",
    badgeClass:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
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
export const SUBTASK_STATUSES = ["todo", "in_progress", "done"] ;
 

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
  done: {
    label: "Done",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

/** Workflow actions a user can take on a task. */


export const ACTION_META = {
  start: { label: "Start work" },
  complete: { label: "Mark complete" },
  cancel: { label: "Cancel task" },
  reopen: { label: "Reopen" },
};

/** Actions available to an assignee based on their own per-person status. */
export function assigneeActions(status) {
  switch (status) {
    case "assigned":
      return ["start", "complete"];
    case "accepted": // legacy
    case "in_progress":
      return ["complete"];
    default:
      return [];
  }
}
