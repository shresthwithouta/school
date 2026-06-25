"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Send,
  LogIn,
  Pencil,
  Trash2,
  CheckCircle2,
  Users,
  ListChecks,
  CheckSquare,
  Square,
  Plus,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichText, RichTextEditor } from "@/components/rich-text";
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";

import { cn, formatDateTime, getInitials } from "@/lib/utils";



export function MeetingPageClient({
  meeting,
  people,
  currentUser,
}



) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const [atts, setAtts] = useState([]);
  const [endOpen, setEndOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [decision, setDecision] = useState("");
  const [decisionDate, setDecisionDate] = useState("");

  const organizer =
    currentUser.id === meeting.createdById || currentUser.tier === "OWNER";
  const me = meeting.attendees.find((a) => a.id === currentUser.id);
  const completed = meeting.status === "completed";
  const canJoin = me && me.status === "invited" && !completed;
  // Anyone on the invite list (or the organizer) can record decisions.
  const isParticipant = !!me || organizer;

  async function addDecision() {
    const text = decision.trim();
    if (!text) return;
    const ok = await api(
      `/api/meetings/${meeting.id}/decisions`,
      "POST",
      { text, dueDate: decisionDate },
      "add-decision"
    );
    if (ok) {
      setDecision("");
      setDecisionDate("");
    }
  }
  const toggleDecision = (d) =>
    api(
      `/api/meetings/${meeting.id}/decisions/${d.id}`,
      "PATCH",
      { done: !d.done },
      `dec-${d.id}`
    );
  const removeDecision = (d) =>
    api(
      `/api/meetings/${meeting.id}/decisions/${d.id}`,
      "DELETE",
      undefined,
      `del-${d.id}`
    );

  async function api(url, method, body, key = "x") {
    setBusy(key);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong");
      return false;
    }
    router.refresh();
    return true;
  }

  async function postMessage() {
    if (!msg.replace(/<[^>]*>/g, "").trim() && atts.length === 0) return;
    setBusy("msg");
    const res = await fetch(`/api/meetings/${meeting.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, attachments: atts }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not send");
      return;
    }
    setMsg("");
    setAtts([]);
    router.refresh();
  }

  async function onDelete() {
    const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not delete");
      return;
    }
    toast.success("Meeting deleted");
    router.push("/meetings");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/meetings">
          <ArrowLeft className="size-4" />
          Back to meetings
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{meeting.key}</span>
            <Badge
              variant="outline"
              className={cn(
                completed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
              )}
            >
              {completed ? "Completed" : "Scheduled"}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            {meeting.scheduledAt ? formatDateTime(meeting.scheduledAt) : "No time set"}
            {" · by "}
            {meeting.createdByName}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canJoin && (
            <Button onClick={() => api(`/api/meetings/${meeting.id}/join`, "POST", undefined, "join")} disabled={!!busy}>
              {busy === "join" ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Join
            </Button>
          )}
          {me?.status === "joined" && !completed && (
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              You joined
            </Badge>
          )}
          {organizer && !completed && (
            <>
              <MeetingDialog
                mode="edit"
                meeting={meeting}
                people={people}
                currentUserId={currentUser.id}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                }
              />
              <Button size="sm" onClick={() => { setSummary(""); setEndOpen(true); }}>
                <CheckCircle2 className="size-4" />
                End meeting
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the meeting and its discussion.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); onDelete(); }}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Final discussion decisions / action points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-4" />
                Decisions & action points
                {meeting.decisions.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {meeting.decisions.filter((d) => d.done).length}/{meeting.decisions.length} done
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isParticipant && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
                  <Textarea
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    placeholder="Add one or more points — one per line…"
                    rows={2}
                    className="bg-background"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground">
                      Target date
                    </label>
                    <Input
                      type="date"
                      value={decisionDate}
                      onChange={(e) => setDecisionDate(e.target.value)}
                      className="h-8 w-auto"
                    />
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={addDecision}
                      disabled={busy === "add-decision" || !decision.trim()}
                    >
                      {busy === "add-decision" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      Add
                    </Button>
                  </div>
                </div>
              )}
              {meeting.decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No decisions recorded yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {meeting.decisions.map((d) => {
                    const overdue = d.overdue;
                    return (
                      <li key={d.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDecision(d)}
                          disabled={!isParticipant || !!busy}
                          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          title={d.done ? "Mark as not done" : "Mark as done"}
                        >
                          {d.done ? (
                            <CheckSquare className="size-4 text-emerald-500" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "text-sm",
                              d.done && "text-muted-foreground line-through"
                            )}
                          >
                            {d.text}
                          </span>
                          {d.dueDate && (
                            <span
                              className={cn(
                                "ml-2 inline-flex items-center gap-1 text-xs",
                                overdue
                                  ? "font-medium text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              <CalendarClock className="size-3" />
                              {formatDateTime(d.dueDate).split(",")[0]}
                            </span>
                          )}
                        </div>
                        {isParticipant && (
                          <button
                            type="button"
                            onClick={() => removeDecision(d)}
                            disabled={!!busy}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            title="Remove"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {meeting.description && (
            <Card>
              <CardHeader><CardTitle className="text-base">Agenda</CardTitle></CardHeader>
              <CardContent>
                <RichText html={meeting.description} className="text-muted-foreground" />
              </CardContent>
            </Card>
          )}

          {completed && meeting.summary && (
            <Card>
              <CardHeader><CardTitle className="text-base">Meeting minutes</CardTitle></CardHeader>
              <CardContent>
                <RichText html={meeting.summary} className="text-muted-foreground" />
              </CardContent>
            </Card>
          )}

          {/* Discussion */}
          <Card>
            <CardHeader><CardTitle className="text-base">Discussion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {meeting.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <ul className="space-y-3">
                  {meeting.messages.map((m) => (
                    <li key={m.id} className="flex gap-3">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {getInitials(m.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-lg border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{m.authorName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(m.createdAt)}
                          </span>
                        </div>
                        <RichText html={m.text} className="mt-1 text-muted-foreground" />
                        {m.attachments?.length > 0 && (
                          <div className="mt-2">
                            <AttachmentList attachments={m.attachments} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!completed && (
                <div className="space-y-2 border-t pt-3">
                  <RichTextEditor
                    value={msg}
                    onChange={setMsg}
                    placeholder="Share a note, file or voice message…"
                    minHeight="min-h-16"
                  />
                  {atts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {atts.map((a, i) => (
                        <span key={i} className="rounded-full border bg-muted px-2 py-1">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <AttachmentUploader onAdd={(a) => setAtts((p) => [...p, a])} />
                    <Button onClick={postMessage} disabled={busy === "msg"}>
                      {busy === "msg" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Send
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendees */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                Attendees ({meeting.joinedCount}/{meeting.invitedCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one invited yet.</p>
              ) : (
                <ul className="space-y-2">
                  {meeting.attendees.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {getInitials(a.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {a.name}
                          {a.id === currentUser.id && (
                            <span className="text-muted-foreground"> (you)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{a.role}</p>
                      </div>
                      {a.status === "joined" ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          {completed ? "Attended" : "Joined"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {completed ? "Absent" : "Invited"}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* End meeting dialog */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End meeting & record minutes</DialogTitle>
            <DialogDescription>
              Attendance is captured automatically from who joined. Add a summary
              of what was discussed and decided.
            </DialogDescription>
          </DialogHeader>
          <RichTextEditor
            value={summary}
            onChange={setSummary}
            placeholder="Minutes, decisions, action items…"
            minHeight="min-h-28"
          />
          <DialogFooter>
            <Button
              disabled={busy === "end"}
              onClick={async () => {
                const ok = await api(`/api/meetings/${meeting.id}/end`, "POST", { summary }, "end");
                if (ok) { setEndOpen(false); toast.success("Meeting ended"); }
              }}
            >
              {busy === "end" && <Loader2 className="size-4 animate-spin" />}
              End meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
