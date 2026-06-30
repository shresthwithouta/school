import crypto from "crypto";
import { cache } from "react";

import { after } from "next/server";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import { emailMeetingInvite, emailMeetingInviteGroup } from "@/lib/email";
import { pushMeetingInvite } from "@/lib/push";
import { canManage, isOwner } from "@/lib/rbac";
import { listVisibleUsers } from "@/lib/users";
import { destroyAsset } from "@/lib/cloudinary";
import Meeting from "@/models/Meeting";

// ── Jira-style meeting keys (deterministic — no DB counter) ────────
/** Stable number from an id — same meeting → same key on every request. */
function keyNum(id) {
  let h = 5381;
  for (const ch of String(id)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h % 100000;
}

function meetingKey(m) {
  return m.key || `ME-${keyNum(m.id)}`;
}

// Version token captured at load time for optimistic concurrency. Non-enumerable
// Symbol so it never serializes into the DB doc or a DTO.
const REV = Symbol("rev");








 







































function now() {
  return new Date().toISOString();
}

function normalize(m) {
  if (!Array.isArray(m.attendees)) m.attendees = [];
  if (!Array.isArray(m.messages)) m.messages = [];
  if (!Array.isArray(m.decisions)) m.decisions = [];
  for (const msg of m.messages) {
    if (!Array.isArray(msg.attachments)) msg.attachments = [];
  }
}

function toDTO(m) {
  const joinedCount = m.attendees.filter((a) => a.status === "joined").length;
  const nowMs = Date.now();
  const decisions = (m.decisions || []).map((d) => ({
    ...d,
    overdue: !d.done && !!d.dueDate && new Date(d.dueDate).getTime() < nowMs,
  }));
  return {
    ...m,
    decisions,
    key: meetingKey(m),
    joinedCount,
    invitedCount: m.attendees.length,
    isFull: m.maxAttendees ? joinedCount >= m.maxAttendees : false,
  };
}

// Accepts the internal UUID or the public key. Falls back to recomputing
// keys across all meetings so a key always resolves.
async function rawById(idOrKey) {
  await connectToDatabase();
  let doc = await Meeting.findOne({
    $or: [{ id: idOrKey }, { key: idOrKey }],
  }).lean();
  if (!doc) {
    const all = await Meeting.find().lean();
    doc = all.find((d) => meetingKey(d) === idOrKey) ?? null;
  }
  if (!doc) return null;
  const m = stripMongo(doc );
  normalize(m);
  // Numeric version for optimistic concurrency. Legacy docs predating `rev`
  // come back as null and migrate on first save.
  Object.defineProperty(m, REV, {
    value: typeof m.rev === "number" ? m.rev : null,
    writable: true,
    enumerable: false,
  });
  return m;
}

// Who may add/tick the final discussion points: anyone on the invite list,
// the organizer, or an owner.
function isParticipant(actor, m) {
  return (
    actor.id === m.createdById ||
    isOwner(actor.role) ||
    m.attendees.some((a) => a.id === actor.id)
  );
}

// Optimistic concurrency — see saveTask in tasks.js. Prevents concurrent joins,
// messages and decision ticks from clobbering each other (last-write-wins).
async function save(m) {
  await connectToDatabase();
  const prev = m[REV];
  if (prev === undefined) {
    m.rev = 1;
    await Meeting.replaceOne({ id: m.id }, m, { upsert: true });
    Object.defineProperty(m, REV, {
      value: m.rev,
      writable: true,
      enumerable: false,
    });
    return;
  }
  const nextRev = (typeof prev === "number" ? prev : 0) + 1;
  m.rev = nextRev;
  const res = await Meeting.replaceOne({ id: m.id, rev: prev }, m);
  if (res.matchedCount === 0) {
    throw new AppError(
      "This meeting was changed by someone else. Refresh and try again.",
      409
    );
  }
  m[REV] = nextRev;
}

function buildAttachment(actor, input) {
  return {
    id: crypto.randomUUID(),
    url: input.url,
    publicId: input.publicId,
    resourceType: input.resourceType,
    format: input.format ?? "",
    bytes: input.bytes,
    name: input.name,
    kind: input.kind,
    uploadedById: actor.id,
    uploadedByName: actor.name,
    createdAt: now(),
  };
}

// ── Visibility ─────────────────────────────────────────────────────
async function visibleUserIds(actor) {
  const users = await listVisibleUsers(actor);
  return new Set(users.map((u) => u.id));
}

function canSee(m, ids) {
  return ids.has(m.createdById) || m.attendees.some((a) => ids.has(a.id));
}

function canManageMeeting(actor, m) {
  return actor.id === m.createdById || isOwner(actor.role);
}

// ── Queries ────────────────────────────────────────────────────────
// Memoized per-request: the dashboard reads the meeting list directly AND via
// listPendingDecisions, so `cache` turns the two Meeting.find() (+ the user
// lookups they each trigger) into one. Scoped to a single request — no staleness.
export const listVisibleMeetings = cache(async function listVisibleMeetings(
  actor
) {
  const ids = await visibleUserIds(actor);
  await connectToDatabase();
  // Only pull meetings the actor can actually see (created by, or attended by,
  // someone in their visible set) — pushed to Mongo and backed by indexes so a
  // worker isn't loading every meeting in the org. canSee stays as a safety net.
  const idList = [...ids];
  const docs = await Meeting.find({
    $or: [
      { createdById: { $in: idList } },
      { "attendees.id": { $in: idList } },
    ],
  }).lean();
  const meetings = docs
    .map((d) => {
      const m = stripMongo(d );
      normalize(m);
      return m;
    })
    .filter((m) => canSee(m, ids));

  return meetings
    .sort((a, b) => {
      const ax = a.scheduledAt ?? a.createdAt;
      const bx = b.scheduledAt ?? b.createdAt;
      return ax < bx ? 1 : -1;
    })
    .map(toDTO);
});

/**
 * Open (un-ticked) discussion decisions across meetings the actor is part of —
 * surfaced on their dashboard until someone ticks them off.
 */
// Pure: pull the open decisions out of an already-fetched meeting list, so a
// caller that already has the meetings (e.g. the dashboard) doesn't pay for a
// second listVisibleMeetings query.
export function pendingDecisionsFromMeetings(meetings, actorId) {
  const out = [];
  for (const m of meetings) {
    if (!m.attendees.some((a) => a.id === actorId)) continue;
    for (const d of m.decisions ?? []) {
      if (!d.done) {
        out.push({
          meetingId: m.id,
          meetingKey: m.key,
          meetingTitle: m.title,
          decisionId: d.id,
          text: d.text,
          dueDate: d.dueDate ?? null,
          overdue: !!d.overdue,
        });
      }
    }
  }
  return out;
}

export async function listPendingDecisions(actor) {
  const meetings = await listVisibleMeetings(actor);
  return pendingDecisionsFromMeetings(meetings, actor.id);
}

export async function getMeetingForActor(
  actor,
  id
) {
  const m = await rawById(id);
  if (!m) return null;
  const ids = await visibleUserIds(actor);
  if (!canSee(m, ids)) return null;
  return toDTO(m);
}

// ── Mutations ──────────────────────────────────────────────────────
// Invite notifications. One invitee → a personalized email. Several at once →
// a single email to the organizer with everyone in CC, so the group can see who
// else is invited (instead of N isolated emails). Always carries the schedule
// and the join link. Each invitee also gets a web-push notification (best-effort
// — no-ops when VAPID isn't configured). `recipients` is [{ id, email, name }]
// and excludes the actor.
function sendInviteNotifications(actor, meeting, recipients) {
  const valid = recipients.filter((r) => r.email || r.id);
  if (valid.length === 0) return Promise.resolve();
  const when = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleString("en-GB")
    : undefined;
  const base = {
    title: meeting.title,
    byName: actor.name,
    meetingId: meeting.id,
    when,
    link: meeting.link || "",
  };
  const withEmail = valid.filter((r) => r.email);
  const tasks = [];
  if (withEmail.length === 1) {
    tasks.push(
      emailMeetingInvite({ ...base, to: withEmail[0].email, attendeeName: withEmail[0].name })
    );
  } else if (withEmail.length > 1) {
    tasks.push(
      emailMeetingInviteGroup({
        ...base,
        to: actor.email,
        cc: withEmail.map((r) => r.email),
        attendeeNames: withEmail.map((r) => r.name).join(", "),
      })
    );
  }
  for (const r of valid) {
    if (r.id) {
      tasks.push(
        pushMeetingInvite({
          userId: r.id,
          title: meeting.title,
          byName: actor.name,
          meetingId: meeting.id,
          when,
        })
      );
    }
  }
  return Promise.allSettled(tasks);
}

export async function createMeeting(
  actor,
  input
) {
  if (!canManage(actor.role)) {
    throw new AppError("Only Owners and Admins can schedule meetings.", 403);
  }

  const visible = await listVisibleUsers(actor);
  const allowed = new Map(visible.map((u) => [u.id, u]));
  const chosen = (input.attendeeIds ?? []).filter((x) => allowed.has(x));

  const ts = now();
  const attendees = chosen.map((cid) => {
    const u = allowed.get(cid);
    return { id: u.id, name: u.name, role: u.role, status: "invited", joinedAt: null };
  });

  const meetingId = crypto.randomUUID();
  const meeting = {
    id: meetingId,
    key: `ME-${keyNum(meetingId)}`,
    title: input.title.trim(),
    description: cleanHtml(input.description),
    link: (input.link ?? "").trim(),
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    createdById: actor.id,
    createdByName: actor.name,
    createdByRole: actor.role,
    attendees,
    messages: [],
    decisions: [],
    status: "scheduled",
    summary: "",
    maxAttendees: input.maxAttendees && input.maxAttendees > 0 ? input.maxAttendees : null,
    createdAt: ts,
    updatedAt: ts,
  };

  await save(meeting);

  // Notify invitees best-effort, after the response is sent — never block the
  // save on a burst of SMTP handshakes. One group email (organizer + CC) when
  // there's more than one invitee.
  const invites = attendees
    .filter((a) => a.id !== actor.id)
    .map((a) => ({ id: a.id, email: allowed.get(a.id)?.email, name: a.name }));
  if (invites.length) {
    after(() => sendInviteNotifications(actor, meeting, invites));
  }

  return toDTO(meeting);
}

export async function updateMeeting(
  actor,
  id,
  input
) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  if (!canManageMeeting(actor, m)) {
    throw new AppError("You can't edit this meeting.", 403);
  }

  if (input.title !== undefined) m.title = input.title.trim();
  if (input.description !== undefined) m.description = cleanHtml(input.description);
  if (input.link !== undefined) m.link = (input.link ?? "").trim();
  if (input.scheduledAt !== undefined) {
    m.scheduledAt = input.scheduledAt
      ? new Date(input.scheduledAt).toISOString()
      : null;
  }
  if (input.maxAttendees !== undefined) {
    m.maxAttendees = input.maxAttendees > 0 ? input.maxAttendees : null;
  }

  const newlyInvited = [];
  if (input.attendeeIds !== undefined) {
    const visible = await listVisibleUsers(actor);
    const allowed = new Map(visible.map((u) => [u.id, u]));
    const chosen = input.attendeeIds.filter((x) => allowed.has(x));
    const existing = new Map(m.attendees.map((a) => [a.id, a]));
    m.attendees = chosen.map((cid) => {
      const cur = existing.get(cid);
      if (cur) return cur;
      const u = allowed.get(cid);
      if (u.id !== actor.id) newlyInvited.push({ id: u.id, email: u.email, name: u.name });
      return { id: u.id, name: u.name, role: u.role, status: "invited", joinedAt: null };
    });
  }

  m.updatedAt = now();
  await save(m);

  if (newlyInvited.length) {
    after(() => sendInviteNotifications(actor, m, newlyInvited));
  }

  return toDTO(m);
}

export async function joinMeeting(
  actor,
  id
) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  if (m.status === "completed") {
    throw new AppError("This meeting has ended.", 400);
  }

  const me = m.attendees.find((a) => a.id === actor.id);
  if (!me) throw new AppError("You're not on the invite list.", 403);
  if (me.status === "joined") return toDTO(m);

  const joined = m.attendees.filter((a) => a.status === "joined").length;
  if (m.maxAttendees && joined >= m.maxAttendees) {
    throw new AppError("This meeting is full.", 400);
  }

  me.status = "joined";
  me.joinedAt = now();
  m.updatedAt = now();
  await save(m);
  return toDTO(m);
}

export async function addMeetingMessage(
  actor,
  id,
  text,
  attachments
) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  // Only the organizer, an owner, or an invited attendee may post — being able
  // to merely *see* the meeting isn't enough.
  if (!isParticipant(actor, m)) {
    throw new AppError("Only people in this meeting can post messages.", 403);
  }
  if (m.status === "completed") {
    throw new AppError("This meeting has ended; the discussion is closed.", 400);
  }

  const clean = cleanHtml(text);
  const atts = (attachments ?? []).map((a) => buildAttachment(actor, a));
  if (!clean && atts.length === 0) {
    throw new AppError("Message cannot be empty.", 400);
  }

  m.messages.push({
    id: crypto.randomUUID(),
    authorId: actor.id,
    authorName: actor.name,
    text: clean,
    attachments: atts,
    createdAt: now(),
  });
  m.updatedAt = now();
  await save(m);
  return toDTO(m);
}

export async function endMeeting(
  actor,
  id,
  summary
) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  if (!canManageMeeting(actor, m)) {
    throw new AppError("Only the organizer can end this meeting.", 403);
  }
  if (m.status === "completed") {
    throw new AppError("This meeting has already ended.", 400);
  }
  m.status = "completed";
  m.summary = cleanHtml(summary);
  m.updatedAt = now();
  await save(m);
  return toDTO(m);
}

// ── Final discussion decisions (bullet points) ─────────────────────
// Accepts one OR many points (one per line) and an optional target date.
export async function addDecision(actor, id, text, dueDate) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  if (!isParticipant(actor, m)) {
    throw new AppError("Only people in this meeting can add decisions.", 403);
  }
  if (m.status === "completed") {
    throw new AppError("This meeting has ended; decisions are locked.", 400);
  }
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (lines.length === 0) throw new AppError("Decision cannot be empty.", 400);

  const due = dueDate ? new Date(dueDate).toISOString() : null;
  const ts = now();
  for (const line of lines) {
    m.decisions.push({
      id: crypto.randomUUID(),
      text: line.slice(0, 500),
      dueDate: due,
      done: false,
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: ts,
      doneById: null,
      doneByName: null,
      doneAt: null,
    });
  }
  m.updatedAt = now();
  await save(m);
  return toDTO(m);
}

export async function setDecisionDone(actor, id, decisionId, done) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  if (!isParticipant(actor, m)) {
    throw new AppError("Only people in this meeting can update decisions.", 403);
  }
  const d = m.decisions.find((x) => x.id === decisionId);
  if (!d) throw new AppError("Decision not found.", 404);

  d.done = !!done;
  d.doneById = done ? actor.id : null;
  d.doneByName = done ? actor.name : null;
  d.doneAt = done ? now() : null;
  m.updatedAt = now();
  await save(m);
  return toDTO(m);
}

export async function deleteDecision(actor, id, decisionId) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  const d = m.decisions.find((x) => x.id === decisionId);
  if (!d) throw new AppError("Decision not found.", 404);
  // Only the person who recorded the decision, the organizer, or an owner may
  // remove it — not any attendee (they could otherwise wipe out others' minutes).
  if (d.createdById !== actor.id && !canManageMeeting(actor, m)) {
    throw new AppError("You can't remove this decision.", 403);
  }
  m.decisions = m.decisions.filter((x) => x.id !== decisionId);
  m.updatedAt = now();
  await save(m);
  return toDTO(m);
}

export async function deleteMeeting(actor, id) {
  const m = await rawById(id);
  if (!m) throw new AppError("Meeting not found.", 404);
  if (!canManageMeeting(actor, m)) {
    throw new AppError("You can't delete this meeting.", 403);
  }
  const assets = m.messages.flatMap((msg) => msg.attachments ?? []);
  await Meeting.deleteOne({ id });
  await Promise.allSettled(
    assets.map((a) => destroyAsset(a.publicId, a.resourceType))
  );
}
