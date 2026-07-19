"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Paperclip, X, Lock } from "lucide-react";

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
import { AttachmentUploader } from "@/components/attachments";
import { toPlainText } from "@/lib/utils";

/**
 * "Submit for review" — an assignee submits their part with a required note and
 * optional files. The files are private (only the assigner and management
 * reviewers can see them). On submit the assigner is emailed.
 */
export function SubmitReviewDialog({ taskId, assigneeId, trigger }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [atts, setAtts] = useState([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!toPlainText(note)) {
      toast.error("Add a short note describing what you're submitting.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/tasks/${taskId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", note, attachments: atts, assigneeId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not submit for review");
      return;
    }
    toast.success("Submitted for review");
    setOpen(false);
    setNote("");
    setAtts([]);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 sm:p-6">
          <DialogTitle>Submit for review</DialogTitle>
          <DialogDescription>
            Describe what you&apos;ve done and attach any files. Your files are
            private — only the person who assigned this task and management can
            see them.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          <RichTextEditor
            value={note}
            onChange={setNote}
            placeholder="What are you submitting? (required)"
            minHeight="min-h-24"
          />

          {atts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {atts.map((a, i) => (
                <span
                  key={`${a.publicId}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2 py-1 text-xs"
                >
                  <Paperclip className="size-3" />
                  <span className="max-w-40 truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setAtts((p) => p.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <AttachmentUploader onAdd={(a) => setAtts((p) => [...p, a])} />
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" />
              Private
            </p>
          </div>
        </div>

        <DialogFooter className="border-t p-4 sm:p-6">
          <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
