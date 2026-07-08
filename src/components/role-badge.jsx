import { Crown, Shield, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTier, TIERS } from "@/lib/rbac";

const TIER_STYLES = {
  [TIERS.OWNER]:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  [TIERS.ADMIN]:
    "border-primary/30 bg-primary/10 text-primary",
  [TIERS.WORKER]:
    "border-border bg-muted text-muted-foreground",
};

const TIER_ICONS = {
  [TIERS.OWNER]: Crown,
  [TIERS.ADMIN]: Shield,
  [TIERS.WORKER]: User,
};

/** Shows the role (Admin / Manager / Teacher / Staff), colored by its tier. */
export function TierBadge({
  role,
  className,
}


) {
  const tier = getTier(role);
  const Icon = TIER_ICONS[tier];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", TIER_STYLES[tier], className)}
    >
      <Icon className="size-3" />
      {role}
    </Badge>
  );
}
