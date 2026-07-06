import crypto from "crypto";
import { cache } from "react";

import { after } from "next/server";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import { canManage, canManageTarget, isOwner } from "@/lib/rbac";
import { store } from "@/lib/store";
import { listAssignableTaskUsers } from "@/lib/users";
import { destroyAsset } from "@/lib/cloudinary";
import {
  describeSchedule,
  isScheduleFreq,
  isDueOn,
  dayKeyOf,
  todayDayKey,
} from "@/lib/recurring-schedule";
import { emailRecurringAssigned, emailRecurringReminder } from "@/lib/email";
import { pushRecurringAssigned, pushRecurringReminder } from "@/lib/push";

import RecurringTask from "@/models/RecurringTask";

// ── Keys, timestamps, small builders ───────────────────────────────
/** Stable number from an id — same doc → same number on every request. */
function keyNum(id) {
  let h = 5381;
  for (const ch of String(id)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h % 100000;
}

function recurringKey(r) {
  return r.key || `RC-${keyNum(r.id)}`;
}

function now() {
  return new Date().toISOString();
}

function activity(actor, message) {
  return {
    id: crypto.randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    message,
    createdAt: now(),
  };
}

function buildFile(actor, input) {
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

// ── Optimistic-concurrency load/save (mirrors lib/tasks) ────────────
const REV = Symbol("rev");

function normalize(r) {
  if (!Array.isArray(r.assignees)) r.assignees = [];
  if (!Array.isArray(r.entries)) r.entries = [];
  if (!Array.isArray(r.activity)) r.activity = [];
  for (const e of r.entries) {
    if (!Array.isArray(e.files)) e.files = [];
  }
}

async function rawById(idOrKey) {
  await connectToDatabase();
  let doc = await RecurringTask.findOne({
    $or: [{ id: idOrKey }, { key: idOrKey }],
  }).lean();
  if (!doc) {
    const all = await RecurringTask.find().lean();
    doc = all.find((d) => recurringKey(d) === idOrKey) ?? null;
  }
  if (!doc) return null;
  const r = stripMongo(doc);
  normalize(r);
  Object.defineProperty(r, REV, {
    value: typeof r.rev === "number" ? r.rev : null,
    writable: true,
    enumerable: false,
  });
  return r;
}

async function saveRecurring(r) {
  await connectToDatabase();
  const prev = r[REV];
  if (prev === undefined) {
    r.rev = 1;
    await RecurringTask.replaceOne({ id: r.id }, r, { upsert: true });
    Object.defineProperty(r, REV, { value: r.rev, writable: true, enumerable: false });
    return;
  }
  const nextRev = (typeof prev === "number" ? prev : 0) + 1;
  r.rev = nextRev;
  const res = await RecurringTask.replaceOne({ id: r.id, rev: prev }, r);
  if (res.matchedCount === 0) {
    throw new AppError(
      "This recurring task was changed by someone else. Refresh and try again.",
      409
    );
  }
  r[REV] = nextRev;
}

// ── Visibility & permissions ───────────────────────────────────────
// Managers (Owner/Admin) see every recurring task; everyone else sees the ones
// they created or are assigned to.
function canSee(actor, r) {
  if (canManage(actor.role)) return true;
  return (
    r.assignerId === actor.id ||
    r.assignees.some((a) => a.id === actor.id)
  );
}

/** Only the creator or a manager over the whole thing may edit/pause/delete. */
function canManageRecurring(actor, r) {
  return r.assignerId === actor.id || canManage(actor.role);
}

// Whose daily uploads a viewer may see: their own always; the creator and the
// Director/Chairman see everyone; other managers see the entries of people they
// manage (per the tier rules). Files live inside the entry, so filtering the
// entry covers its files too.
function canSeeEntry(actor, r, entry) {
  if (entry.assigneeId === actor.id) return true;
  if (r.assignerId === actor.id) return true;
  if (isOwner(actor.role)) return true;
  if (canManage(actor.role)) {
    const a = r.assignees.find((x) => x.id === entry.assigneeId);
    return a ? canManageTarget(actor.role, a.role) : false;
  }
  return false;
}

/** DTO with `key`, entries the viewer may not see stripped out, and a `canEdit`. */
function viewRecurring(actor, r) {
  const dto = { ...r, key: recurringKey(r) };
  dto.entries = (r.entries || []).filter((e) => canSeeEntry(actor, r, e));
  dto.canEdit = canManageRecurring(actor, r);
  dto.isAssignee = r.assignees.some((a) => a.id === actor.id);
  return dto;
}

// ── Reads ──────────────────────────────────────────────────────────
export const listVisibleRecurring = cache(async function listVisibleRecurring(actor) {
  await connectToDatabase();
  const filter = canManage(actor.role)
    ? {}
    : { $or: [{ assignerId: actor.id }, { "assignees.id": actor.id }] };
  const docs = await RecurringTask.find(filter).lean();
  return docs
    .map((d) => {
      const r = stripMongo(d);
      normalize(r);
      return r;
    })
    .filter((r) => canSee(actor, r))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((r) => viewRecurring(actor, r));
});

export async function getRecurringForActor(actor, id) {
  const r = await rawById(id);
  if (!r) return null;
  if (!canSee(actor, r)) return null;
  return viewRecurring(actor, r);
}

// ── Notifications (best-effort; never block a save) ─────────────────
async function notifyAssigned(actor, r, recipients) {
  const jobs = [];
  for (const rec of recipients) {
    if (rec.email) {
      jobs.push(
        emailRecurringAssigned({
          to: rec.email,
          assigneeName: rec.name,
          taskTitle: r.title,
          assignerName: actor.name,
          cadence: describeSchedule(r.schedule),
          recurringId: r.id,
        })
      );
    }
    jobs.push(
      pushRecurringAssigned({
        userId: rec.id,
        taskTitle: r.title,
        assignerName: actor.name,
        recurringId: r.id,
      })
    );
  }
  await Promise.allSettled(jobs);
}

// ── Writes ─────────────────────────────────────────────────────────
export async function createRecurring(actor, input) {
  if (!isScheduleFreq(input.schedule?.freq)) {
    throw new AppError("Choose how often this repeats.", 400);
  }
  const assignable = await listAssignableTaskUsers(actor);
  const allowed = new Map(assignable.map((u) => [u.id, u]));
  const chosen = (input.assigneeIds ?? []).filter((id) => allowed.has(id));
  if (chosen.length === 0) {
    throw new AppError("Assign at least one person to a recurring task.", 400);
  }

  const assignees = chosen.map((id) => {
    const u = allowed.get(id);
    return { id: u.id, name: u.name, role: u.role };
  });

  const ts = now();
  const id = crypto.randomUUID();
  const title = input.title.trim();
  const schedule = {
    freq: input.schedule.freq,
    ...(input.schedule.freq === "everyN"
      ? { intervalDays: Math.max(1, Number(input.schedule.intervalDays) || 1) }
      : {}),
    ...(input.schedule.freq === "weekly"
      ? { weekday: Number(input.schedule.weekday) || 0 }
      : {}),
  };
  // Start today unless a later start was given; normalize to that IST day's ISO.
  const startDate = input.startDate ? new Date(input.startDate).toISOString() : ts;
  const endDate = input.endDate ? new Date(input.endDate).toISOString() : null;

  const names = assignees.map((a) => a.name).join(", ");
  const r = {
    id,
    key: `RC-${keyNum(id)}`,
    title,
    description: cleanHtml(input.description),
    priority: input.priority,
    schedule,
    startDate,
    endDate,
    paused: false,
    pausedAt: null,
    active: true,
    assignerId: actor.id,
    assignerName: actor.name,
    assignerRole: actor.role,
    assignees,
    entries: [],
    activity: [
      activity(
        actor,
        `created a recurring task (${describeSchedule(schedule)}) for ${names}`
      ),
    ],
    createdAt: ts,
    updatedAt: ts,
  };

  await saveRecurring(r);

  const recipients = assignees
    .filter((a) => a.id !== actor.id)
    .map((a) => ({ id: a.id, email: allowed.get(a.id)?.email, name: a.name }));
  if (recipients.length) {
    after(() => notifyAssigned(actor, r, recipients));
  }

  return viewRecurring(actor, r);
}

export async function updateRecurring(actor, id, input) {
  const r = await rawById(id);
  if (!r) throw new AppError("Recurring task not found.", 404);
  if (!canManageRecurring(actor, r)) {
    throw new AppError("You are not allowed to edit this recurring task.", 403);
  }

  // Lifecycle actions are exclusive and independent of field edits.
  if (input.action === "pause") {
    if (!r.active) throw new AppError("This recurring task has ended.", 400);
    r.paused = true;
    r.pausedAt = now();
    r.activity.push(activity(actor, "paused this recurring task"));
  } else if (input.action === "resume") {
    if (!r.active) throw new AppError("This recurring task has ended.", 400);
    r.paused = false;
    r.pausedAt = null;
    r.activity.push(activity(actor, "resumed this recurring task"));
  } else if (input.action === "end") {
    r.active = false;
    r.paused = false;
    r.activity.push(activity(actor, "ended this recurring task"));
  }

  if (input.title !== undefined) r.title = input.title.trim();
  if (input.description !== undefined) r.description = cleanHtml(input.description);
  if (input.priority !== undefined) r.priority = input.priority;
  if (input.endDate !== undefined) {
    r.endDate = input.endDate ? new Date(input.endDate).toISOString() : null;
  }

  const addedRecipients = [];
  if (input.assigneeIds !== undefined) {
    const assignable = await listAssignableTaskUsers(actor);
    const allowed = new Map(assignable.map((u) => [u.id, u]));
    const chosen = input.assigneeIds.filter((x) => allowed.has(x));
    if (chosen.length === 0) {
      throw new AppError("A recurring task needs at least one assignee.", 400);
    }
    const existing = new Map(r.assignees.map((a) => [a.id, a]));
    r.assignees = chosen.map((cid) => {
      const cur = existing.get(cid);
      if (cur) return cur;
      const u = allowed.get(cid);
      if (u.id !== actor.id) {
        addedRecipients.push({ id: u.id, email: u.email, name: u.name });
      }
      return { id: u.id, name: u.name, role: u.role };
    });
  }

  r.updatedAt = now();
  await saveRecurring(r);

  if (addedRecipients.length) {
    after(() => notifyAssigned(actor, r, addedRecipients));
  }
  return viewRecurring(actor, r);
}

export async function deleteRecurring(actor, id) {
  const r = await rawById(id);
  if (!r) throw new AppError("Recurring task not found.", 404);
  if (!canManageRecurring(actor, r)) {
    throw new AppError("You are not allowed to delete this recurring task.", 403);
  }
  // Destroy every uploaded asset so deleting the record doesn't orphan files.
  const assets = [];
  for (const e of r.entries) {
    for (const f of e.files || []) {
      if (f.publicId) assets.push({ publicId: f.publicId, resourceType: f.resourceType });
    }
  }
  await connectToDatabase();
  await RecurringTask.deleteOne({ id: r.id });
  if (assets.length) {
    after(() =>
      Promise.allSettled(assets.map((a) => destroyAsset(a.publicId, a.resourceType)))
    );
  }
}

// ── Daily entries ──────────────────────────────────────────────────
export async function upsertEntry(actor, id, input) {
  const r = await rawById(id);
  if (!r) throw new AppError("Recurring task not found.", 404);
  const mine = r.assignees.find((a) => a.id === actor.id);
  if (!mine) {
    throw new AppError("Only an assignee can log a result here.", 403);
  }
  if (!r.active) throw new AppError("This recurring task has ended.", 400);
  if (r.paused) throw new AppError("This recurring task is paused.", 400);

  const today = todayDayKey();
  const day = input.day || today;
  // No logging ahead of time.
  if (day > today) throw new AppError("You can't log a result for a future day.", 400);
  const startKey = dayKeyOf(r.startDate) || today;
  if (day < startKey) throw new AppError("That day is before this task started.", 400);
  if (!isDueOn(r.schedule, day, startKey)) {
    throw new AppError("That day isn't a scheduled day for this task.", 400);
  }

  const ts = now();
  const files = (input.files ?? []).map((f) => buildFile(actor, f));
  const existing = r.entries.find(
    (e) => e.assigneeId === actor.id && e.day === day
  );

  if (existing) {
    // Replacing the entry — destroy any files that were dropped.
    const keptIds = new Set(files.map((f) => f.publicId));
    const dropped = (existing.files || []).filter(
      (f) => f.publicId && !keptIds.has(f.publicId)
    );
    existing.note = input.note.trim();
    existing.files = files;
    existing.updatedAt = ts;
    r.activity.push(activity(actor, `updated their result for ${day}`));
    if (dropped.length) {
      after(() =>
        Promise.allSettled(dropped.map((f) => destroyAsset(f.publicId, f.resourceType)))
      );
    }
  } else {
    r.entries.push({
      id: crypto.randomUUID(),
      day,
      assigneeId: actor.id,
      assigneeName: mine.name,
      note: input.note.trim(),
      files,
      createdAt: ts,
      updatedAt: ts,
    });
    r.activity.push(activity(actor, `logged a result for ${day}`));
  }

  r.updatedAt = ts;
  await saveRecurring(r);
  return viewRecurring(actor, r);
}

export async function deleteEntry(actor, id, entryId) {
  const r = await rawById(id);
  if (!r) throw new AppError("Recurring task not found.", 404);
  const entry = r.entries.find((e) => e.id === entryId);
  if (!entry) throw new AppError("Entry not found.", 404);
  // The person who logged it, the creator, or a manager may remove it.
  const allowed =
    entry.assigneeId === actor.id || canManageRecurring(actor, r);
  if (!allowed) {
    throw new AppError("You are not allowed to remove this entry.", 403);
  }
  const assets = (entry.files || []).filter((f) => f.publicId);
  r.entries = r.entries.filter((e) => e.id !== entryId);
  r.activity.push(activity(actor, `removed the result for ${entry.day}`));
  r.updatedAt = now();
  await saveRecurring(r);
  if (assets.length) {
    after(() =>
      Promise.allSettled(assets.map((f) => destroyAsset(f.publicId, f.resourceType)))
    );
  }
  return viewRecurring(actor, r);
}

// ── Daily reminder sweep (replaces the old spawn cron) ──────────────
// Pings every assignee who hasn't logged today's due entry yet. Idempotent to
// run repeatedly; best-effort notifications. Returns a small summary for logs.
export async function sendRecurringReminders() {
  await connectToDatabase();
  const today = todayDayKey();
  const docs = await RecurringTask.find({ active: true, paused: false }).lean();

  let reminded = 0;
  const errors = [];
  for (const doc of docs) {
    try {
      const r = stripMongo(doc);
      normalize(r);
      const startKey = dayKeyOf(r.startDate) || today;
      if (!isDueOn(r.schedule, today, startKey)) continue;
      if (r.endDate && today > dayKeyOf(r.endDate)) continue;

      for (const a of r.assignees) {
        const logged = r.entries.some(
          (e) => e.assigneeId === a.id && e.day === today
        );
        if (logged) continue;
        const u = await store.findById(a.id);
        const jobs = [];
        if (u?.email) {
          jobs.push(
            emailRecurringReminder({
              to: u.email,
              assigneeName: a.name,
              taskTitle: r.title,
              recurringId: r.id,
            })
          );
        }
        jobs.push(
          pushRecurringReminder({
            userId: a.id,
            taskTitle: r.title,
            recurringId: r.id,
          })
        );
        await Promise.allSettled(jobs);
        reminded++;
      }
    } catch (err) {
      errors.push({ id: doc.id, error: err?.message || String(err) });
    }
  }
  return { reminded, considered: docs.length, errors };
}
