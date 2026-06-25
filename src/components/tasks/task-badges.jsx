import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,


} from "@/lib/task-meta";

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
