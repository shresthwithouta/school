"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderArchive,
  FileText,
  Download,
  Trash2,
  Share2,
  CheckSquare,
  Square,
  Loader2,
  Users,
  Lock,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { formatBytes } from "@/lib/attachment";
import { cn, formatDateTime } from "@/lib/utils";

export function RepositoryClient({ files, people, isChairman }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [shareFor, setShareFor] = useState(null); // file being shared
  const [shareIds, setShareIds] = useState([]);

  const nameOf = useMemo(
    () => new Map(people.map((p) => [p.id, p.name])),
    [people]
  );

  const allSelected = files.length > 0 && selected.size === files.length;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(files.map((f) => f.id)));
  }

  async function doDelete(ids) {
    if (ids.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/repository/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not delete");
      return;
    }
    toast.success(`Deleted ${ids.length} file${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    router.refresh();
  }

  function openShare(file) {
    setShareFor(file);
    setShareIds(file.sharedWith ?? []);
  }

  async function saveShare() {
    if (!shareFor) return;
    setBusy(true);
    const res = await fetch(`/api/repository/${shareFor.id}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: shareIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not update sharing");
      return;
    }
    toast.success("Sharing updated");
    setShareFor(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FolderArchive className="size-6" />
            Repository
          </h1>
          <p className="text-sm text-muted-foreground">
            {isChairman
              ? "Saved files. Share them with people or delete them permanently."
              : "Files the Chairman has shared with you."}
          </p>
        </div>

        {isChairman && files.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {allSelected ? "Clear" : "Select all"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={selected.size === 0 || busy}
                >
                  <Trash2 className="size-4" />
                  Delete ({selected.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selected.size} file{selected.size === 1 ? "" : "s"} permanently?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the file{selected.size === 1 ? "" : "s"} from the
                    repository and deletes the upload from storage (Cloudinary).
                    This cannot be undone. Are you sure you really want to delete
                    permanently?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      doDelete([...selected]);
                    }}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {files.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderArchive className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">No files yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {isChairman
              ? "Save a submitted file from a task to keep it here."
              : "Nothing has been shared with you yet."}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {files.map((f) => {
                const isSel = selected.has(f.id);
                const sharedNames = (f.sharedWith ?? [])
                  .map((id) => nameOf.get(id))
                  .filter(Boolean);
                return (
                  <li key={f.id} className="flex items-center gap-3 p-3 sm:px-4">
                    {isChairman && (
                      <button
                        type="button"
                        onClick={() => toggle(f.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title={isSel ? "Deselect" : "Select"}
                      >
                        {isSel ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    )}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {f.name}
                      </a>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatBytes(f.bytes)}
                        {f.sourceTitle ? ` · from ${f.sourceTitle}` : ""}
                        {" · saved "}
                        {formatDateTime(f.createdAt)}
                      </p>
                      {isChairman && sharedNames.length > 0 && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          Shared with {sharedNames.join(", ")}
                        </p>
                      )}
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title="Download"
                    >
                      <Download className="size-4" />
                    </a>
                    {isChairman && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        title="Share"
                        onClick={() => openShare(f)}
                      >
                        <Share2 className="size-4" />
                      </Button>
                    )}
                    {!isChairman && (
                      <Lock
                        className="size-3.5 shrink-0 text-muted-foreground"
                        title="Shared with you"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Share dialog (Chairman) */}
      <Dialog open={!!shareFor} onOpenChange={(o) => !o && setShareFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share file</DialogTitle>
            <DialogDescription>
              {shareFor?.name
                ? `Choose who can see "${shareFor.name}" in their repository.`
                : "Choose who can see this file."}
            </DialogDescription>
          </DialogHeader>
          <UserCombobox
            users={people}
            value={shareIds}
            onChange={setShareIds}
            currentUserId={null}
            placeholder="Search people to share with…"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveShare} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
              Save sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
