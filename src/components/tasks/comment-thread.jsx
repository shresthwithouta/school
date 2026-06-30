"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Reply, Send, Paperclip, X, Lock } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import { MentionPicker } from "@/components/tasks/mention-picker";
import { cn, formatDateTime, getInitials, toPlainText } from "@/lib/utils";

const MAX_INDENT = 4;
// A comment that mentions someone must be a real message (matches the server).
const MENTION_MIN_CHARS = 50;

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

// A reusable composer: rich-text + attachments + an @mention picker. The mention
// picker is only offered to people who can post private mentions (the creator);
// for everyone else mentions just notify, so we keep the box simpler.
function Composer({ ctx, value, setValue, atts, setAtts, mentions, setMentions, placeholder, minHeight, submitting, onSubmit, submitLabel }) {
  const { participants, currentUser, isCreator } = ctx;
  const tooShort =
    mentions.length > 0 && toPlainText(value).length < MENTION_MIN_CHARS;
  const empty = !toPlainText(value) && atts.length === 0;

  return (
    <div className="space-y-2">
      <RichTextEditor
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        minHeight={minHeight}
      />
      <PendingAtts
        items={atts}
        onRemove={(i) => setAtts((a) => a.filter((_, idx) => idx !== i))}
      />
      {isCreator && participants.length > 1 && (
        <MentionPicker
          participants={participants}
          value={mentions}
          onChange={setMentions}
          excludeId={currentUser?.id}
        />
      )}
      {mentions.length > 0 && (
        <p className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
          <Lock className="size-3" />
          Private — only you, the people you mention and managers can see this
          {tooShort ? ` · at least ${MENTION_MIN_CHARS} characters` : ""}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <AttachmentUploader onAdd={(a) => setAtts((prev) => [...prev, a])} />
        <Button
          size="sm"
          disabled={submitting || empty || tooShort}
          onClick={onSubmit}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {submitLabel}
        </Button>
      </div>
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
    replyMentions,
    setReplyMentions,
    busy,
    post,
    nameOf,
  } = ctx;
  const replies = childrenOf.get(comment.id) ?? [];
  const isFeedback = comment.kind === "feedback";
  const isSubmission = comment.kind === "submission";
  const isPrivate = comment.visibility === "private";
  const mentionNames = (comment.mentions ?? [])
    .map((id) => nameOf.get(id))
    .filter(Boolean);
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
              isFeedback && "border-amber-500/30 bg-amber-500/5",
              (isSubmission || isPrivate) && "border-violet-500/30 bg-violet-500/5"
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
                {isSubmission && (
                  <span className="ml-2 text-xs font-normal text-violet-600 dark:text-violet-400">
                    submission
                  </span>
                )}
                {isPrivate && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-violet-600 dark:text-violet-400">
                    <Lock className="size-3" />
                    private
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(comment.createdAt)}
              </span>
            </div>
            {mentionNames.length > 0 && (
              <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                {mentionNames.map((n) => `@${n}`).join(" ")}
              </p>
            )}
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
                ctx={ctx}
                value={replyText}
                setValue={setReplyText}
                atts={replyAtts}
                setAtts={setReplyAtts}
                mentions={replyMentions}
                setMentions={setReplyMentions}
                placeholder={`Reply to ${comment.authorName}…`}
                minHeight="min-h-14"
                submitting={busy === comment.id}
                submitLabel="Reply"
                onSubmit={() => post(replyText, comment.id, replyAtts, replyMentions)}
              />
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setReplyText("");
                  setReplyAtts([]);
                  setReplyMentions([]);
                }}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
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

export function CommentThread({
  taskId,
  comments,
  participants = [],
  currentUser,
  isCreator = false,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [rootText, setRootText] = useState("");
  const [rootAtts, setRootAtts] = useState([]);
  const [rootMentions, setRootMentions] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyAtts, setReplyAtts] = useState([]);
  const [replyMentions, setReplyMentions] = useState([]);

  const nameOf = useMemo(
    () => new Map(participants.map((p) => [p.id, p.name])),
    [participants]
  );

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

  async function post(text, parentId, attachments, mentions) {
    if (!toPlainText(text) && attachments.length === 0) return;
    setBusy(parentId ?? "root");
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        parentId: parentId ?? "",
        attachments,
        mentions: mentions ?? [],
      }),
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
      setReplyMentions([]);
    } else {
      setRootText("");
      setRootAtts([]);
      setRootMentions([]);
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
    replyMentions,
    setReplyMentions,
    busy,
    post,
    nameOf,
    participants,
    currentUser,
    isCreator,
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

      <div className="border-t pt-3">
        <Composer
          ctx={ctx}
          value={rootText}
          setValue={setRootText}
          atts={rootAtts}
          setAtts={setRootAtts}
          mentions={rootMentions}
          setMentions={setRootMentions}
          placeholder="Write a comment…"
          minHeight="min-h-16"
          submitting={busy === "root"}
          submitLabel="Comment"
          onSubmit={() => post(rootText, null, rootAtts, rootMentions)}
        />
      </div>
    </div>
  );
}
