"use client";

import { useMemo, useState } from "react";
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

// Module-level (stable) component so it isn't recreated on every keystroke,
// which would remount the reply editor and drop focus after one character.
function CommentNode({ comment, depth, childrenOf, ctx }) {
  const {
    replyTo,
    setReplyTo,
    replyText,
    setReplyText,
    replyAtts,
    setReplyAtts,
    busy,
    post,
  } = ctx;
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
            <div className="mt-2 space-y-2">
              <RichTextEditor
                value={replyText}
                onChange={setReplyText}
                placeholder={`Reply to ${comment.authorName}…`}
                minHeight="min-h-14"
              />
              <PendingAtts
                items={replyAtts}
                onRemove={(i) =>
                  setReplyAtts((a) => a.filter((_, idx) => idx !== i))
                }
              />
              <div className="flex items-center justify-between gap-2">
                <AttachmentUploader
                  onAdd={(a) => setReplyAtts((prev) => [...prev, a])}
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyText("");
                      setReplyAtts([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      busy === comment.id ||
                      (!toPlainText(replyText) && replyAtts.length === 0)
                    }
                    onClick={() => post(replyText, comment.id, replyAtts)}
                  >
                    {busy === comment.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Reply
                  </Button>
                </div>
              </div>
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
}

export function CommentThread({ taskId, comments }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [rootText, setRootText] = useState("");
  const [rootAtts, setRootAtts] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyAtts, setReplyAtts] = useState([]);

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

  async function post(text, parentId, attachments) {
    if (!toPlainText(text) && attachments.length === 0) return;
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
      return;
    }
    if (parentId) {
      setReplyTo(null);
      setReplyText("");
      setReplyAtts([]);
    } else {
      setRootText("");
      setRootAtts([]);
    }
    router.refresh();
  }

  const roots = childrenOf.get(null) ?? [];
  const ctx = {
    replyTo,
    setReplyTo,
    replyText,
    setReplyText,
    replyAtts,
    setReplyAtts,
    busy,
    post,
  };

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

      <div className="space-y-2 border-t pt-3">
        <RichTextEditor
          value={rootText}
          onChange={setRootText}
          placeholder="Write a comment…"
          minHeight="min-h-16"
        />
        <PendingAtts
          items={rootAtts}
          onRemove={(i) => setRootAtts((a) => a.filter((_, idx) => idx !== i))}
        />
        <div className="flex items-center justify-between gap-2">
          <AttachmentUploader onAdd={(a) => setRootAtts((prev) => [...prev, a])} />
          <Button
            onClick={() => post(rootText, null, rootAtts)}
            disabled={busy === "root" || (!toPlainText(rootText) && rootAtts.length === 0)}
          >
            {busy === "root" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
