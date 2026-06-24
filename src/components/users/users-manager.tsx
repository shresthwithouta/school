"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { canManageTarget } from "@/lib/rbac";
import { formatDate, getInitials } from "@/lib/utils";
import type { UserDTO } from "@/lib/users";

export function UsersManager({
  users,
  actorId,
  actorRole,
}: {
  users: UserDTO[];
  actorId: string;
  actorRole: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserDTO | null>(null);
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/users/${deleteTarget.id}`, {
      method: "DELETE",
    });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
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
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const isSelf = u.id === actorId;
                const canManage = !isSelf && canManageTarget(actorRole, u.role);
                return (
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
                            <span className="truncate font-medium">
                              {u.name}
                            </span>
                            {isSelf && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{u.role}</span>
                    </TableCell>
                    <TableCell>
                      <TierBadge role={u.role} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {u.department || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canManage && (
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
                              user={u}
                              trigger={
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="gap-2"
                                >
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
                                setDeleteTarget(u);
                              }}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              &apos;s account. They will no longer be able to sign in. This
              cannot be undone.
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
