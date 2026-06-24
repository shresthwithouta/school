/**
 * Task metadata — pure data + helpers, safe to import in client components.
 * (The data layer in `lib/tasks.ts` uses the filesystem and is server-only.)
 */

export const TASK_STATUSES = [
  "assigned",
  "accepted",
  "in_progress",
  "submitted",
  "completed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; description: string; badgeClass: string }
> = {
  assigned: {
    label: "Assigned",
    description: "Waiting for the assignee to accept.",
    badgeClass:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  accepted: {
    label: "Accepted",
    description: "Accepted, not started yet.",
    badgeClass:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  },
  in_progress: {
    label: "In progress",
    description: "Being worked on.",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  submitted: {
    label: "In review",
    description: "Submitted, awaiting review.",
    badgeClass:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  completed: {
    label: "Completed",
    description: "Approved and closed.",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; badgeClass: string; dotClass: string }
> = {
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

/** Workflow actions a user can take on a task. */
export type TaskAction = "accept" | "start" | "submit" | "approve" | "reject";

export const ACTION_META: Record<TaskAction, { label: string }> = {
  accept: { label: "Accept" },
  start: { label: "Start work" },
  submit: { label: "Submit for review" },
  approve: { label: "Approve" },
  reject: { label: "Request changes" },
};

/** Actions available to an assignee based on their own per-person status. */
export function assigneeActions(status: TaskStatus | null): TaskAction[] {
  switch (status) {
    case "assigned":
      return ["accept"];
    case "accepted":
      return ["start", "submit"];
    case "in_progress":
      return ["submit"];
    default:
      return [];
  }
}

/** Can an assignee edit their progress in this status? */
export function canEditProgress(status: TaskStatus | null): boolean {
  return status === "accepted" || status === "in_progress";
}
