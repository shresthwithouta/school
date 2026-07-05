"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/rich-text";

/**
 * "Send back" — a reviewer (the task creator or a manager) returns a submitted
 * part to its assignee for changes, with an optional message describing what
 * needs improving. The message is emailed to the assignee and added as a public
 * feedback comment on the task; the submission drops back to in-progress so they
 * can redo it and submit again.
 */
export function SendBackDialog({ taskId, assignee, trigger }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/tasks/${taskId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sendback", assigneeId: assignee.id, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not send this back");
      return;
    }
    toast.success(`Sent back to ${assignee.name} for changes`);
    setOpen(false);
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 sm:p-6">
          <DialogTitle>Send back for changes</DialogTitle>
          <DialogDescription>
            Return {assignee.name}&apos;s submission for improvement. Your message
            is emailed to them and added to the task&apos;s comments so they know
            what to redo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <RichTextEditor
            value={note}
            onChange={setNote}
            placeholder="What needs improving? (optional, but recommended)"
            minHeight="min-h-24"
          />
        </div>

        <DialogFooter className="border-t p-4 sm:p-6">
          <Button
            onClick={submit}
            disabled={busy}
            variant="outline"
            className="w-full text-amber-600 sm:w-auto dark:text-amber-400"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Undo2 className="size-4" />
            )}
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
