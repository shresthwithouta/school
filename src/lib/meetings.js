import crypto from "crypto";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import { emailMeetingInvite } from "@/lib/email";
import { canManage, isOwner } from "@/lib/rbac";
import { listVisibleUsers } from "@/lib/users";
import { destroyAsset } from "@/lib/cloudinary";
import Meeting from "@/models/Meeting";








 







































function now() {
  return new Date().toISOString();
}

function normalize(m) {
  if (!Array.isArray(m.attendees)) m.attendees = [];
  if (!Array.isArray(m.messages)) m.messages = [];
  for (const msg of m.messages) {
    if (!Array.isArray(msg.attachments)) msg.attachments = [];
  }
}

function toDTO(m) {
  const joinedCount = m.attendees.filter((a) => a.status === "joined").length;
  return {
    ...m,
    joinedCount,
    invitedCount: m.attendees.length,
    isFull: m.maxAttendees ? joinedCount >= m.maxAttendees : false,
  };
}

async function rawById(id) {
  await connectToDatabase();
  const doc = await Meeting.findOne({ id }).lean();
  if (!doc) return null;
  const m = stripMongo(doc );
  normalize(m);
  return m;
}

async function save(m) {
  await connectToDatabase();
  await Meeting.replaceOne({ id: m.id }, m, { upsert: true });
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
export async function listVisibleMeetings(
  actor
) {
  const ids = await visibleUserIds(actor);
  await connectToDatabase();
  const docs = await Meeting.find().lean();
  return docs
    .map((d) => {
      const m = stripMongo(d );
      normalize(m);
      return m;
    })
    .filter((m) => canSee(m, ids))
    .sort((a, b) => {
      const ax = a.scheduledAt ?? a.createdAt;
      const bx = b.scheduledAt ?? b.createdAt;
      return ax < bx ? 1 : -1;
    })
    .map(toDTO);
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

  const meeting = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    description: cleanHtml(input.description),
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    createdById: actor.id,
    createdByName: actor.name,
    createdByRole: actor.role,
    attendees,
    messages: [],
    status: "scheduled",
    summary: "",
    maxAttendees: input.maxAttendees && input.maxAttendees > 0 ? input.maxAttendees : null,
    createdAt: ts,
    updatedAt: ts,
  };

  await save(meeting);

  const whenStr = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleString("en-GB")
    : undefined;
  await Promise.allSettled(
    attendees.map((a) => {
      const u = allowed.get(a.id);
      return u
        ? emailMeetingInvite({
            to: u.email,
            attendeeName: a.name,
            title: meeting.title,
            byName: actor.name,
            meetingId: meeting.id,
            when: whenStr,
          })
        : Promise.resolve();
    })
  );

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
      newlyInvited.push({ to: u.email, name: u.name });
      return { id: u.id, name: u.name, role: u.role, status: "invited", joinedAt: null };
    });
  }

  m.updatedAt = now();
  await save(m);

  const whenStr = m.scheduledAt
    ? new Date(m.scheduledAt).toLocaleString("en-GB")
    : undefined;
  await Promise.allSettled(
    newlyInvited.map((r) =>
      emailMeetingInvite({
        to: r.to,
        attendeeName: r.name,
        title: m.title,
        byName: actor.name,
        meetingId: m.id,
        when: whenStr,
      })
    )
  );

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
  const ids = await visibleUserIds(actor);
  if (!canSee(m, ids)) {
    throw new AppError("You can't post in this meeting.", 403);
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
  m.status = "completed";
  m.summary = cleanHtml(summary);
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
