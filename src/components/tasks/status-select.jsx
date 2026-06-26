"use client";

import { ChevronDown, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/tasks/task-badges";
import { cn } from "@/lib/utils";

// Each workflow action moves the task toward a status; the dot previews where it
// lands using the same colour language as the status badges.
const ACTION_DOT = {
  start: "bg-amber-500",
  complete: "bg-emerald-500",
  cancel: "bg-muted-foreground",
  reopen: "bg-sky-500",
};

/**
 * Jira-style status switcher. The trigger shows the current status; the menu
 * lists the workflow transitions the current user is allowed to take. Built on
 * the DropdownMenu primitive so it opens reliably and the panel is portalled
 * (never clipped by the surrounding card).
 */
export function StatusSelect({ status, options, busy, onSelect }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        aria-label="Change status"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors",
          "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/40",
          "dark:bg-input/30 dark:hover:bg-input/50"
        )}
      >
        {busy ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Updating…
          </span>
        ) : (
          <StatusBadge status={status} />
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onSelect(o.value)}
            className="gap-2"
          >
            <span className={cn("size-2 shrink-0 rounded-full", ACTION_DOT[o.value])} />
            <span className="flex-1">{o.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
