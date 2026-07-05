import { Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,


} from "@/lib/task-meta";
import { describeRecurrence } from "@/lib/recurrence";

export function StatusBadge({
  status,
  className,
}


) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", meta.badgeClass, className)}
    >
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
}


) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", meta.badgeClass, className)}
    >
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </Badge>
  );
}

/**
 * Marks a recurring-task template (e.g. "Daily", "Mon–Sat"). Renders nothing
 * for one-off tasks or spawned occurrences (which carry no rule of their own).
 */
export function RecurringBadge({ recurrence, className }) {
  if (!recurrence?.freq) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
        className
      )}
    >
      <Repeat className="size-3" />
      {describeRecurrence(recurrence)}
    </Badge>
  );
}

export function OverdueBadge({ className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-rose-500/30 bg-rose-500/10 font-medium text-rose-700 dark:text-rose-400",
        className
      )}
    >
      Overdue
    </Badge>
  );
}
