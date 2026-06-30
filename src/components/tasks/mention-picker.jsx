"use client";

import { useState } from "react";
import { AtSign, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

/**
 * Pick people to @mention in a comment. Sources from the task's participants
 * (creator + assignees). When the task creator mentions someone the comment
 * becomes private — the composer handles that warning + the 50-char minimum.
 */
export function MentionPicker({ participants, value, onChange, excludeId, disabled }) {
  const [open, setOpen] = useState(false);

  const options = participants.filter(
    (p) => p.id !== excludeId && !value.includes(p.id)
  );
  const selected = value
    .map((id) => participants.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <AtSign className="size-3.5" />
          Mention
        </button>
        {selected.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs"
          >
            @{p.name}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== p.id))}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${p.name}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {options.length === 0 ? (
            <li className="p-2 text-xs text-muted-foreground">No one to mention.</li>
          ) : (
            options.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...value, p.id]);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                >
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                      {getInitials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.role}</p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
