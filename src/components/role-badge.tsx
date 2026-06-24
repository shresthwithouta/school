import { Crown, Shield, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTier, TIERS, TIER_LABELS, type Tier } from "@/lib/rbac";

const TIER_STYLES: Record<Tier, string> = {
  [TIERS.OWNER]:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  [TIERS.ADMIN]:
    "border-primary/30 bg-primary/10 text-primary",
  [TIERS.WORKER]:
    "border-border bg-muted text-muted-foreground",
};

const TIER_ICONS: Record<Tier, typeof Crown> = {
  [TIERS.OWNER]: Crown,
  [TIERS.ADMIN]: Shield,
  [TIERS.WORKER]: User,
};

/** Shows the access tier (Owner / Admin / Worker) for a role. */
export function TierBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  const tier = getTier(role);
  const Icon = TIER_ICONS[tier];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", TIER_STYLES[tier], className)}
    >
      <Icon className="size-3" />
      {TIER_LABELS[tier]}
    </Badge>
  );
}

/** Shows the actual role title as a subtle badge. */
export function RoleBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("font-medium", className)}>
      {role}
    </Badge>
  );
}
