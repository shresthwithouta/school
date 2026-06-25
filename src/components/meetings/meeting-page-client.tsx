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
import { RichText, RichTextEditor } from "@/components/rich-text";
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import type { AssignableUser } from "@/components/tasks/user-combobox";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import type { UploadedAttachment } from "@/lib/attachment";
import type { MeetingDTO } from "@/lib/meetings";

export function MeetingPageClient({
  meeting,
  people,
  currentUser,
}: {
  meeting: MeetingDTO;
  people: AssignableUser[];
  currentUser: { id: string; role: string; tier: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [atts, setAtts] = useState<UploadedAttachment[]>([]);
  const [endOpen, setEndOpen] = useState(false);
  const [summary, setSummary] = useState("");

  const organizer =
    currentUser.id === meeting.createdById || currentUser.tier === "OWNER";
  const me = meeting.attendees.find((a) => a.id === currentUser.id);
  const completed = meeting.status === "completed";
  const canJoin = me && me.status === "invited" && !completed;

  async function api(url: string, method: string, body?: unknown, key = "x") {
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
