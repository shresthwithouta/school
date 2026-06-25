"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, UserPlus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TierBadge } from "@/components/role-badge";
import { UserDialog } from "@/components/users/user-dialog";
import { canManageTarget, ROLES } from "@/lib/rbac";
import { formatDate, getInitials } from "@/lib/utils";

function StatusBadge({ active }) {
  return active ? (
    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}

function MemberActions({ user, actorRole, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <UserDialog
          mode="edit"
          actorRole={actorRole}
          user={user}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          }
        />
        <DropdownMenuItem
          variant="destructive"
          className="gap-2"
          onSelect={(e) => {
            e.preventDefault();
            onDelete(user);
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UsersManager({ users, actorId, actorRole }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.role, u.department]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [users, query]);

  // Group filtered members by role, in the canonical role order.
  const groups = useMemo(() => {
    const byRole = new Map();
    for (const u of filtered) {
      if (!byRole.has(u.role)) byRole.set(u.role, []);
      byRole.get(u.role).push(u);
    }
    const ordered = ROLES.filter((r) => byRole.has(r)).map((r) => [r, byRole.get(r)]);
    // Any unknown/legacy roles after the known ones.
    for (const [r, list] of byRole) {
      if (!ROLES.includes(r)) ordered.push([r, list]);
    }
    return ordered;
  }, [filtered]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not delete user");
      return;
    }
    toast.success(`${deleteTarget.name} removed`);
    setDeleteTarget(null);
    router.refresh();
  }

  const canManageRow = (u) => u.id !== actorId && canManageTarget(actorRole, u.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="section">By role</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <UserDialog
          mode="create"
          actorRole={actorRole}
          trigger={
            <Button>
              <UserPlus className="size-4" />
              Add member
            </Button>
          }
        />
      </div>

      {view === "list" ? (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Last login</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={u.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{u.name}</span>
                            {u.id === actorId && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm">{u.role}</span></TableCell>
                    <TableCell><TierBadge role={u.role} /></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{u.department || "—"}</span>
                    </TableCell>
                    <TableCell><StatusBadge active={u.isActive} /></TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canManageRow(u) && (
                        <MemberActions user={u} actorRole={actorRole} onDelete={setDeleteTarget} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No members found.
            </div>
          ) : (
            groups.map(([role, members]) => (
              <div key={role} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{role}</h3>
                  <Badge variant="secondary" className="text-xs">{members.length}</Badge>
                </div>
                <div className="overflow-hidden rounded-xl border">
                  <ul className="divide-y">
                    {members.map((u) => (
                      <li key={u.id} className="flex items-center gap-3 p-3">
                        <Avatar className="size-9">
                          <AvatarImage src={u.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{u.name}</span>
                            {u.id === actorId && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                            {u.department ? ` · ${u.department}` : ""}
                          </p>
                        </div>
                        <StatusBadge active={u.isActive} />
                        {canManageRow(u) && (
                          <MemberActions user={u} actorRole={actorRole} onDelete={setDeleteTarget} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>
              &apos;s account. They will no longer be able to sign in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
