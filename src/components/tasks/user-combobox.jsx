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
  // When true, only one person can be chosen: picking a new one replaces the
  // current selection and the search input hides until it's cleared.
  single = false,
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

  // Quick "add a whole group" buttons (multi-select only). One per role that has
  // at least one not-yet-selected person, plus "Everyone". Lets a creator assign
  // e.g. all Teachers at once instead of picking them one by one.
  const groups = useMemo(() => {
    if (single) return [];
    const byRole = new Map();
    for (const u of users) {
      if (!byRole.has(u.role)) byRole.set(u.role, []);
      byRole.get(u.role).push(u.id);
    }
    return [...byRole.entries()]
      .map(([role, ids]) => ({
        role,
        ids,
        remaining: ids.filter((id) => !value.includes(id)).length,
      }))
      .filter((g) => g.remaining > 0)
      .sort((a, b) => (a.role < b.role ? -1 : 1));
  }, [users, value, single]);

  function add(id) {
    onChange(single ? [id] : [...value, id]);
    setQuery("");
    if (single) setOpen(false);
  }
  function addMany(ids) {
    // Union with the current selection, preserving order and avoiding dupes.
    const next = [...value];
    for (const id of ids) if (!next.includes(id)) next.push(id);
    onChange(next);
    setQuery("");
  }
  function remove(id) {
    onChange(value.filter((x) => x !== id));
  }

  // In single mode, hide the search box once someone is picked — clear the
  // current choice (the × on the chip) to pick a different person.
  const atMax = single && value.length >= 1;

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

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {users.length > 1 && (
            <button
              type="button"
              onClick={() => addMany(users.map((u) => u.id))}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              + Everyone
            </button>
          )}
          {groups.map((g) => (
            <button
              key={g.role}
              type="button"
              onClick={() => addMany(g.ids)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              + All {g.role} ({g.remaining})
            </button>
          ))}
        </div>
      )}

      {!atMax && (
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
      )}
    </div>
  );
}
