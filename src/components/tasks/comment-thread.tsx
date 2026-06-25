"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Reply, Send } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { cn, formatDateTime, getInitials, toPlainText } from "@/lib/utils";
import type { TaskComment } from "@/lib/tasks";

const MAX_INDENT = 4;

export function CommentThread({
  taskId,
  comments,
}: {
  taskId: string;
  comments: TaskComment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rootText, setRootText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, TaskComment[]>();
    for (const c of comments) {
      const key = c.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    }
    return map;
  }, [comments]);

  async function post(text: string, parentId: string | null) {
    if (!toPlainText(text)) return;
    setBusy(parentId ?? "root");
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, parentId: parentId ?? "" }),
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
    } else {
      setRootText("");
    }
    router.refresh();
  }

  const roots = childrenOf.get(null) ?? [];

  function Node({ comment, depth }: { comment: TaskComment; depth: number }) {
    const replies = childrenOf.get(comment.id) ?? [];
    const isFeedback = comment.kind === "feedback";
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
            </div>

            <button
              type="button"
              onClick={() =>
                setReplyTo((r) => (r === comment.id ? null : comment.id))
              }
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Reply className="size-3.5" />
              Reply
            </button>

            {replyTo === comment.id && (
              <div className="mt-2 space-y-2">
                <RichTextEditor
                  value={replyText}
                  onChange={setReplyText}
                  placeholder={`Reply to ${comment.authorName}…`}
                  minHeight="min-h-14"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy === comment.id || !toPlainText(replyText)}
                    onClick={() => post(replyText, comment.id)}
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
            )}

            {replies.length > 0 && (
              <div className="mt-3 space-y-3">
                {replies.map((r) => (
                  <Node
                    key={r.id}
                    comment={r}
                    depth={Math.min(depth + 1, MAX_INDENT)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {roots.map((c) => (
            <Node key={c.id} comment={c} depth={0} />
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
        <div className="flex justify-end">
          <Button
            onClick={() => post(rootText, null)}
            disabled={busy === "root" || !toPlainText(rootText)}
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
