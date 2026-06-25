"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";

 

export function UserCombobox({
  users,
  value,
  onChange,
  currentUserId,
  placeholder,
}





) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedUsers = value
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) ;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(
        (u) =>
          !value.includes(u.id) &&
          (!q || `${u.name} ${u.role}`.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [users, value, query]);

  function add(id) {
    onChange([...value, id]);
    setQuery("");
  }
  function remove(id) {
    onChange(value.filter((x) => x !== id));
  }

  return (
    <div className="space-y-2">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted py-1 pl-1 pr-2 text-sm"
            >
              <Avatar className="size-5">
                <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                  {getInitials(u.name)}
                </AvatarFallback>
              </Avatar>
              {u.name}
              {u.id === currentUserId ? " (you)" : ""}
              <button
                type="button"
                onClick={() => remove(u.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${u.name}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          value={query}
          placeholder={placeholder ?? "Type a name to add…"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              add(matches[0].id);
            }
          }}
        />
        {open && matches.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
            {matches.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(u.id)}
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name}
                      {u.id === currentUserId ? " (you)" : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.role}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
