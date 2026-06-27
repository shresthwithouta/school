"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Reply, Send, Paperclip, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import { cn, formatDateTime, getInitials, toPlainText } from "@/lib/utils";

const MAX_INDENT = 4;

function PendingAtts({ items, onRemove }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((a, i) => (
        <span
          key={`${a.publicId}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2 py-1 text-xs"
        >
          <Paperclip className="size-3" />
          <span className="max-w-40 truncate">{a.name}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// A self-contained composer that keeps its draft text/attachments in LOCAL
// state. Because the draft never lives on the thread, typing here re-renders
// only this box — not every comment in the thread. Used for both the root
// comment box and inline replies (replies pass an onCancel).
function Composer({
  onSubmit,
  busy,
  placeholder,
  minHeight,
  submitLabel,
  onCancel,
}) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState([]);

  const canSend = !!toPlainText(text) || atts.length > 0;

  const submit = async () => {
    if (!canSend) return;
    const ok = await onSubmit(text, atts);
    if (ok) {
      setText("");
      setAtts([]);
    }
  };

  return (
    <div className="space-y-2">
      <RichTextEditor
        value={text}
        onChange={setText}
        placeholder={placeholder}
        minHeight={minHeight}
      />
      <PendingAtts
        items={atts}
        onRemove={(i) => setAtts((a) => a.filter((_, idx) => idx !== i))}
      />
      <div className="flex items-center justify-between gap-2">
        <AttachmentUploader onAdd={(a) => setAtts((prev) => [...prev, a])} />
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            size={onCancel ? "sm" : "default"}
            onClick={submit}
            disabled={busy || !canSend}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Module-level + memoized so a re-render of the thread (or another node's reply)
// doesn't re-render every node. Props are stable while typing because the draft
// state lives inside each Composer, and `ctx` is memoized in the parent.
const CommentNode = memo(function CommentNode({ comment, depth, childrenOf, ctx }) {
  const { replyTo, setReplyTo, busy, post } = ctx;
  const replies = childrenOf.get(comment.id) ?? [];
  const isFeedback = comment.kind === "feedback";
  const open = replyTo === comment.id;

  return (
    <div className={cn(depth > 0 && "border-l pl-3 sm:pl-4")}>
      <div className="flex gap-3">
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-primary/10 text-xs text-primary">
            {getInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "rounded-lg border p-2.5",
              isFeedback && "border-amber-500/30 bg-amber-500/5"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {comment.authorName}
                {isFeedback && (
                  <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                    feedback
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(comment.createdAt)}
              </span>
            </div>
            <RichText html={comment.text} className="mt-1 text-muted-foreground" />
            {comment.attachments?.length > 0 && (
              <div className="mt-2">
                <AttachmentList attachments={comment.attachments} />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setReplyTo(open ? null : comment.id)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Reply className="size-3.5" />
            Reply
          </button>

          {open && (
            <div className="mt-2">
              <Composer
                onSubmit={(text, atts) => post(text, comment.id, atts)}
                onCancel={() => setReplyTo(null)}
                busy={busy === comment.id}
                placeholder={`Reply to ${comment.authorName}…`}
                minHeight="min-h-14"
                submitLabel="Reply"
              />
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {replies.map((r) => (
                <CommentNode
                  key={r.id}
                  comment={r}
                  depth={Math.min(depth + 1, MAX_INDENT)}
                  childrenOf={childrenOf}
                  ctx={ctx}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export function CommentThread({ taskId, comments }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  const childrenOf = useMemo(() => {
    const map = new Map();
    for (const c of comments) {
      const key = c.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    }
    return map;
  }, [comments]);

  // Stable across keystrokes (only taskId/router are deps), so memoized
  // CommentNodes don't re-render while someone is typing a comment. Returns
  // whether the post succeeded so the Composer can clear itself.
  const post = useCallback(
    async (text, parentId, attachments) => {
      if (!toPlainText(text) && attachments.length === 0) return false;
      setBusy(parentId ?? "root");
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, parentId: parentId ?? "", attachments }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(null);
      if (!res.ok) {
        toast.error(data.error ?? "Could not post comment");
        return false;
      }
      if (parentId) setReplyTo(null);
      router.refresh();
      return true;
    },
    [taskId, router]
  );

  const roots = childrenOf.get(null) ?? [];

  // Memoized context handed to every node — only changes when the open reply or
  // busy state changes, not on every keystroke (drafts live inside Composer).
  const ctx = useMemo(
    () => ({ replyTo, setReplyTo, busy, post }),
    [replyTo, busy, post]
  );

  return (
    <div className="space-y-4">
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {roots.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              depth={0}
              childrenOf={childrenOf}
              ctx={ctx}
            />
          ))}
        </div>
      )}

      <div className="border-t pt-3">
        <Composer
          onSubmit={(text, atts) => post(text, null, atts)}
          busy={busy === "root"}
          placeholder="Write a comment…"
          minHeight="min-h-16"
          submitLabel="Comment"
        />
      </div>
    </div>
  );
}
