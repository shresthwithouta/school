import crypto from "crypto";
import { cache } from "react";

import { after } from "next/server";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import {
  emailTaskAssigned,
  emailTaskAssignedGroup,
  emailTaskCompleted,
  emailTaskSubmitted,
  emailSubmissionReturned,
  emailTaskApproved,
  emailSubtaskSubmitted,
  emailSubtaskApproved,
  emailSubtaskReturned,
  emailMention,
  emailSubtaskAssigned,
  emailTaskRecurring,
  emailTaskDelayed,
  emailSubtaskDelayed,
  emailTaskDueSoon,
  emailSubtaskDueSoon,
} from "@/lib/email";
import {
  pushTaskAssigned,
  pushTaskCompleted,
  pushSubtaskAssigned,
  pushTaskSubmitted,
  pushSubmissionReturned,
  pushTaskApproved,
  pushSubtaskSubmitted,
  pushSubtaskApproved,
  pushSubtaskReturned,
  pushTaskDelayed,
  pushSubtaskDelayed,
  pushTaskDueSoon,
  pushSubtaskDueSoon,
} from "@/lib/push";
import {
  computeNextRun,
  occurrenceDueFor,
  describeRecurrence,
} from "@/lib/recurrence";
import { todayDayKey } from "@/lib/recurring-schedule";
import { canManage, isOwner } from "@/lib/rbac";
import {
  canReviewTask,
  canSeeAttachment,
  canSeeComment,
} from "@/lib/task-access";
import { store } from "@/lib/store";
import { listAssignableTaskUsers } from "@/lib/users";
import { destroyAsset } from "@/lib/cloudinary";


import Task from "@/models/Task";

// ── Jira-style task keys (deterministic — no DB counter) ───────────
/** Two-letter prefix from the title (uppercased), falling back to "TK". */
function keyPrefix(title) {
  const letters = String(title || "").replace(/[^a-zA-Z]/g, "");
  const p = letters.slice(0, 2).toUpperCase();
  return p.length === 2 ? p : "TK";
}

/** Stable number from an id — same task → same number on every request. */
function keyNum(id) {
  let h = 5381;
  for (const ch of String(id)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h % 100000;
}

/**
 * The public key for a task. Derived deterministically from the id so the list
 * and the detail route always compute the same value — the route resolves it
 * by recomputing keys, so it never depends on a stored field or a counter.
 */
function taskKey(t) {
  return t.key || `${keyPrefix(t.title)}-${keyNum(t.id)}`;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
// How far ahead of a deadline the "due soon" reminder fires (see
// sendUpcomingDueReminders).
const DUE_SOON_WINDOW_MS = HOUR_MS;

// Version token captured at load time for optimistic concurrency. Stored as a
// non-enumerable Symbol so it never serializes into the DB doc or a DTO.
const REV = Symbol("rev");














 











































































// ── Persistence (MongoDB) ──────────────────────────────────────────
// Accepts the internal UUID or the public key. Falls back to recomputing
// keys across all tasks so a key always resolves even if never persisted.
async function rawById(idOrKey) {
  await connectToDatabase();
  let doc = await Task.findOne({
    $or: [{ id: idOrKey }, { key: idOrKey }],
  }).lean();
  if (!doc) {
    const all = await Task.find().lean();
    doc = all.find((d) => taskKey(d) === idOrKey) ?? null;
  }
  if (!doc) return null;
  const task = stripMongo(doc );
  normalizeTask(task);
  // Remember the numeric version we read so saveTask can detect concurrent
  // writes. Legacy docs predating `rev` come back as null and migrate on first
  // save (matched by `{ rev: null }`, which also matches a missing field).
  Object.defineProperty(task, REV, {
    value: typeof task.rev === "number" ? task.rev : null,
    writable: true,
    enumerable: false,
  });
  return task;
}

function normalizeTask(task) {
  if (!Array.isArray(task.assignees)) task.assignees = [];
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  if (!Array.isArray(task.attachments)) task.attachments = [];
  if (!Array.isArray(task.comments)) task.comments = [];
  for (const c of task.comments) {
    if (!Array.isArray(c.attachments)) c.attachments = [];
  }
}

// Optimistic concurrency: an existing task is only overwritten if its numeric
// `rev` still matches the value we read (REV). On every save we bump `rev`, so
// if another request changed (or deleted) it in between, the write is rejected
// with a 409 instead of silently clobbering their change. A monotonic counter
// (not the millisecond `updatedAt`) means two writes in the same millisecond
// can't both pass the guard and lose an update. Brand-new tasks are inserted.
async function saveTask(task) {
  await connectToDatabase();
  const prev = task[REV];
  if (prev === undefined) {
    // Never loaded from the DB → genuinely new document.
    task.rev = 1;
    await Task.replaceOne({ id: task.id }, task, { upsert: true });
    Object.defineProperty(task, REV, {
      value: task.rev,
      writable: true,
      enumerable: false,
    });
    return;
  }
  const nextRev = (typeof prev === "number" ? prev : 0) + 1;
  task.rev = nextRev;
  const res = await Task.replaceOne({ id: task.id, rev: prev }, task);
  if (res.matchedCount === 0) {
    throw new AppError(
      "This task was changed by someone else. Refresh and try again.",
      409
    );
  }
  task[REV] = nextRev;
}

function now() {
  return new Date().toISOString();
}

function newAssignee(u) {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    status: "assigned",
    completedAt: null,
  };
}

// ── Derived task-level values ──────────────────────────────────────
// Status precedence: cancelled → draft → completed → delayed → in_progress
// → assigned. "Delayed" is any open task past its due date.
function deriveTaskStatus(t) {
  if (t.cancelled) return "cancelled";
  const a = t.assignees;
  if (a.length === 0) return "draft";
  const allAssigneesDone = a.every((x) => x.status === "completed");
  // A task isn't finished until its subtasks are done too — open subtasks keep
  // it active even when every assignee has marked their part complete.
  const subtasksOpen = (t.subtasks || []).some((s) => s.status !== "done");
  if (allAssigneesDone && !subtasksOpen) return "completed";
  if (t.dueDate && new Date(t.dueDate).getTime() < Date.now()) return "delayed";
  // Someone has submitted their part and it's waiting on a reviewer to approve.
  if (a.some((x) => x.status === "submitted")) return "in_review";
  if (allAssigneesDone || a.some((x) => x.status === "in_progress")) {
    return "in_progress";
  }
  return "assigned";
}

function toDTO(t) {
  const status = deriveTaskStatus(t);
  const delayed = status === "delayed";
  const daysLate =
    delayed && t.dueDate
      ? Math.max(1, Math.ceil((Date.now() - new Date(t.dueDate).getTime()) / DAY_MS))
      : 0;
  const subtasks = (t.subtasks || []).map((s, i) => ({
    ...s,
    key: s.key || `SB-${i + 1}`,
    overdue:
      s.status !== "done" &&
      !!s.expectedDate &&
      new Date(s.expectedDate).getTime() < Date.now(),
  }));
  return {
    ...t,
    subtasks,
    key: taskKey(t),
    status,
    isDraft: status === "draft",
    cancelled: !!t.cancelled,
    delayed,
    overdue: delayed, // alias kept for older callers
    daysLate,
  };
}

// Actor-aware serialization. toDTO derives the public shape; viewTask then hides
// what this viewer isn't allowed to see: private submission files (only the
// uploader, the task creator and management reviewers) and private comments
// (e.g. an @mention by the creator). Comment TEXT stays public — only files
// inside a comment are filtered. Every endpoint that returns a task to a client
// goes through this so the data never leaks past the UI. See lib/task-access.js.
function viewTask(actor, t) {
  const dto = toDTO(t);
  dto.attachments = (dto.attachments || []).filter((a) =>
    canSeeAttachment(actor, t, a)
  );
  dto.comments = (dto.comments || [])
    .filter((c) => canSeeComment(actor, t, c))
    .map((c) =>
      (c.attachments || []).every((a) => canSeeAttachment(actor, t, a))
        ? c
        : { ...c, attachments: c.attachments.filter((a) => canSeeAttachment(actor, t, a)) }
    );
  return dto;
}

/** Plain-text length of sanitized HTML — used to enforce comment minimums. */
function plainTextLength(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
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

// Next subtask key number — monotonic per task, never reused. Derived from a
// stored counter (subSeq) and the highest existing key so old tasks migrate
// safely. This keeps SB-keys (and the URLs built from them) stable when a
// subtask in the middle is deleted.
function nextSubKeyNum(task) {
  let max = task.subSeq ?? 0;
  for (const s of task.subtasks || []) {
    const n = parseInt(String(s.key || "").replace(/^SB-/, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
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

// ── Visibility & permissions ───────────────────────────────────────
// Chairman/Director, Principal and Manager (the management tiers) can see
// every task across the school. Everyone else sees only tasks they created,
// are assigned to, or are assigned a subtask of — a subtask assignee can open
// the parent task (the subtask URL is /<task>/<subtask>) to do their part.
function canSeeTask(actor, task) {
  if (canManage(actor.role)) return true;
  return (
    task.assignerId === actor.id ||
    task.assignees.some((a) => a.id === actor.id) ||
    (task.subtasks || []).some((s) => s.assigneeId === actor.id)
  );
}

// "Involved" = anyone collaborating on the task: its creator (assigner), any
// assignee, or a management tier. These people can drive the task workflow and
// manage subtasks. Note: a subtask's assignee need not already be on the task —
// any involved person may assign subtasks to anyone within their own authority.
function isInvolved(actor, task) {
  return (
    actor.id === task.assignerId ||
    task.assignees.some((a) => a.id === actor.id) ||
    canManage(actor.role)
  );
}

// Anyone involved in the task can cancel / reopen it (move it through its
// workflow), not just the creator and management tiers.
function canControlTask(actor, task) {
  return isInvolved(actor, task);
}

// Only the creator (assigner) or a manager (Owner/Admin tier) may edit the
// task itself — e.g. move the due date. Assignees cannot.
function canEdit(actor, task) {
  return actor.id === task.assignerId || canManage(actor.role);
}

// Deletion is broader than editing: the creator can delete their own task, and
// the Chairman/Director (Owner) can delete ANY task for oversight/cleanup.
function canDeleteTask(actor, task) {
  return canEdit(actor, task) || isOwner(actor.role);
}

// ── Queries ────────────────────────────────────────────────────────
// Memoized per-request: the dashboard alone asks for the visible task list more
// than once (directly + via getTaskStats), and `cache` collapses those into a
// single Task.find() for that request without affecting later requests.
export const listVisibleTasks = cache(async function listVisibleTasks(actor) {
  await connectToDatabase();
  // Managers (Owner/Admin) see every task, so load all. Everyone else only sees
  // tasks they're connected to — push that filter to Mongo (backed by indexes)
  // so a worker never loads the entire org's task collection just to discard
  // most of it. canSeeTask below stays as a safety net / final authority.
  const filter = canManage(actor.role)
    ? {}
    : {
        $or: [
          { assignerId: actor.id },
          { "assignees.id": actor.id },
          { "subtasks.assigneeId": actor.id },
        ],
      };
  const docs = await Task.find(filter).lean();
  return docs
    .map((d) => {
      const t = stripMongo(d );
      normalizeTask(t);
      return t;
    })
    .filter((t) => canSeeTask(actor, t))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((t) => viewTask(actor, t));
});

export async function getTaskForActor(
  actor,
  id
) {
  const task = await rawById(id);
  if (!task) return null;
  if (!canSeeTask(actor, task)) return null;
  return viewTask(actor, task);
}

 









// Pure: derive the dashboard KPI counts from an already-fetched task list, so a
// caller that already has the list (e.g. the dashboard) doesn't pay for a second
// listVisibleTasks query just to count statuses.
export function computeTaskStats(tasks, actorId) {
  const stats = {
    total: tasks.length,
    draft: 0,
    pending: 0,
    inProgress: 0,
    inReview: 0,
    delayed: 0,
    completed: 0,
    cancelled: 0,
    assignedToMe: 0,
  };
  for (const t of tasks) {
    if (t.status === "draft") stats.draft += 1;
    else if (t.status === "assigned") stats.pending += 1;
    else if (t.status === "in_progress") stats.inProgress += 1;
    else if (t.status === "in_review") stats.inReview += 1;
    else if (t.status === "delayed") stats.delayed += 1;
    else if (t.status === "completed") stats.completed += 1;
    else if (t.status === "cancelled") stats.cancelled += 1;
    if (t.assignees.some((a) => a.id === actorId)) stats.assignedToMe += 1;
  }
  return stats;
}

export async function getTaskStats(actor) {
  return computeTaskStats(await listVisibleTasks(actor), actor.id);
}

// ── Analytics ──────────────────────────────────────────────────────
 





















export async function getTaskAnalytics(actor) {
  const tasks = await listVisibleTasks(actor);

  











  // Per-person breakdown. Owners are excluded — they don't carry tasks.
  const map = new Map();
  for (const t of tasks) {
    if (t.status === "draft" || t.status === "cancelled") continue;
    for (const a of t.assignees) {
      if (isOwner(a.role)) continue;
      const e =
        map.get(a.id) ?? {
          name: a.name,
          role: a.role,
          assigned: 0,
          completed: 0,
          delayed: 0,
          open: 0,
        };
      e.assigned += 1;
      if (a.status === "completed") {
        e.completed += 1;
      } else {
        e.open += 1;
        if (t.delayed) e.delayed += 1;
      }
      map.set(a.id, e);
    }
  }

  const perUser = [...map.entries()]
    .map(([id, e]) => ({
      id,
      ...e,
      // Partition each person's assignments: completed + delayed + onTrack.
      // `onTrack` is the open work that isn't past due (delayed ⊄ onTrack), so
      // the columns sum to `assigned` instead of double-counting delayed work.
      onTrack: Math.max(0, e.open - e.delayed),
      completionRate: e.assigned ? Math.round((e.completed / e.assigned) * 100) : 0,
    }))
    .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned);

  // Org totals over real (assigned, non-draft, non-cancelled) tasks. These form
  // a clean partition: completed + delayed + onTrack === totalAssigned.
  const active = tasks.filter(
    (t) => t.status !== "draft" && t.status !== "cancelled"
  );
  const completedTasks = active.filter((t) => t.status === "completed").length;
  const delayedTasks = active.filter((t) => t.status === "delayed").length;

  return {
    totalAssigned: active.length,
    completedTasks,
    delayedTasks,
    onTrack: Math.max(0, active.length - completedTasks - delayedTasks),
    completionRate: active.length
      ? Math.round((completedTasks / active.length) * 100)
      : 0,
    perUser,
  };
}

// ── Mutations ──────────────────────────────────────────────────────
// Full-oversight recipients (every manager — Owner + Admin tier) for task/
// subtask review events — the "management" audience beyond the direct
// assigner/assignee, so every manager sees a submit/return/complete even when
// they're not on the task themselves.
// `exclude` is a set of ids already being notified separately (avoids duplicates).
async function oversightRecipients(exclude) {
  const users = await store.list();
  return users.filter((u) => canManage(u.role) && !exclude.has(u.id));
}

// Assignment notifications. One person → a personalized email. Multiple people
// at once → a single email addressed to the assigner with everyone in CC, so the
// whole group can see who else is on the task (instead of N isolated emails).
// Each assignee also gets a web-push notification (best-effort — no-ops without
// VAPID). `recipients` is [{ id, email, name }], including the assigner if they
// assigned themselves.
function sendAssignmentNotifications(actor, task, recipients) {
  const valid = recipients.filter((r) => r.email || r.id);
  if (valid.length === 0) return Promise.resolve();
  const withEmail = valid.filter((r) => r.email);
  const tasks = [];
  if (withEmail.length === 1) {
    tasks.push(
      emailTaskAssigned({
        to: withEmail[0].email,
        assigneeName: withEmail[0].name,
        taskTitle: task.title,
        assignerName: actor.name,
        taskId: task.id,
      })
    );
  } else if (withEmail.length > 1) {
    tasks.push(
      emailTaskAssignedGroup({
        to: actor.email,
        cc: withEmail.map((r) => r.email),
        assigneeNames: withEmail.map((r) => r.name).join(", "),
        taskTitle: task.title,
        assignerName: actor.name,
        taskId: task.id,
      })
    );
  }
  for (const r of valid) {
    if (r.id) {
      tasks.push(
        pushTaskAssigned({
          userId: r.id,
          taskTitle: task.title,
          assignerName: actor.name,
          taskId: task.id,
        })
      );
    }
  }
  return Promise.allSettled(tasks);
}

// ── Recurring tasks ────────────────────────────────────────────────
// A recurring template spawns a fresh, independent occurrence each period. The
// clone copies the "what" (title, description, priority, assignees) but resets
// the "state" (fresh per-assignee status, new id/key, empty comments/subtasks/
// files, its own activity log) and carries no recurrence rule of its own, so it
// never spawns further tasks. It points back to the template via
// `recurrenceParentId`.
function cloneRecurringOccurrence(template) {
  const ts = now();
  const title = template.title;
  const id = crypto.randomUUID();
  const assignees = (template.assignees || []).map((a) =>
    newAssignee({ id: a.id, name: a.name, role: a.role })
  );
  return {
    id,
    key: `${keyPrefix(title)}-${keyNum(id)}`,
    title,
    description: template.description,
    priority: template.priority,
    dueDate: occurrenceDueFor(template.nextRunAt),
    recurrence: null,
    recurrenceParentId: template.id,
    nextRunAt: null,
    cancelled: false,
    cancelledAt: null,
    subSeq: 0,
    assignerId: template.assignerId,
    assignerName: template.assignerName,
    assignerRole: template.assignerRole,
    assignees,
    subtasks: [],
    comments: [],
    attachments: [],
    activity: [
      {
        id: crypto.randomUUID(),
        actorId: template.assignerId,
        actorName: template.assignerName,
        message: `created automatically from the recurring task "${title}"`,
        createdAt: ts,
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  };
}

// Emails each assignee their daily task and pushes to their devices. Unlike a
// one-off assignment (a single group-CC announcement to the assigner), a
// recurring occurrence is a personal "do this today" reminder — so each
// assignee is emailed directly. Best-effort; a failed send never blocks a spawn.
async function sendRecurringNotifications(template, occ) {
  const jobs = [];
  for (const a of occ.assignees) {
    const u = await store.findById(a.id);
    if (u?.email) {
      jobs.push(
        emailTaskRecurring({
          to: u.email,
          assigneeName: a.name,
          taskTitle: occ.title,
          assignerName: template.assignerName,
          taskId: occ.id,
          freq: template.recurrence.freq,
        })
      );
    }
    jobs.push(
      pushTaskAssigned({
        userId: a.id,
        taskTitle: occ.title,
        assignerName: template.assignerName,
        taskId: occ.id,
      })
    );
  }
  await Promise.allSettled(jobs);
}

/**
 * Spawn one occurrence for every recurring template that's due, then advance its
 * schedule. Idempotent within a run (nextRunAt moves past "now", so a second run
 * the same day finds nothing) and self-healing across missed runs (it resumes
 * with the current day rather than back-filling). Called by the daily cron —
 * see /api/cron/recurring. Returns a small summary for the response/logs.
 */
export async function spawnDueRecurringTasks() {
  await connectToDatabase();
  const nowIso = now();
  // ISO-8601 UTC strings sort chronologically, so a lexicographic `$lte` on the
  // string is a correct "due" test.
  const due = await Task.find({
    "recurrence.active": true,
    nextRunAt: { $ne: null, $lte: nowIso },
  })
    .select("id")
    .lean();

  let spawned = 0;
  const errors = [];
  for (const { id } of due) {
    try {
      // Reload through rawById so saveTask's optimistic-concurrency guard is
      // armed — if someone edits the template mid-sweep, we retry next run.
      const template = await rawById(id);
      if (!template?.recurrence?.active || !template.nextRunAt) continue;
      if (template.nextRunAt > nowIso) continue; // no longer due

      // Build the occurrence from the *current* slot (its due date derives from
      // the slot we're firing), then advance and save the template FIRST. That
      // rev-guarded write claims the slot: a concurrent sweep — or a template
      // edited mid-run — hits a 409 here and drops out, so the day's task can't
      // be spawned twice. Only once the slot is safely claimed do we insert the
      // occurrence and notify.
      const occ = cloneRecurringOccurrence(template);
      template.nextRunAt = computeNextRun(template.recurrence.freq, nowIso);
      template.updatedAt = now();
      await saveTask(template);

      await saveTask(occ);
      spawned++;
      await sendRecurringNotifications(template, occ);
    } catch (err) {
      // One bad template must not abort the whole sweep.
      errors.push({ id, error: err?.message || String(err) });
    }
  }
  return { spawned, considered: due.length, errors };
}

export async function createTask(
  actor,
  input
) {
  const assignable = await listAssignableTaskUsers(actor);
  const allowed = new Map(assignable.map((u) => [u.id, u]));
  // Empty assignees is allowed — the task is saved as a draft.
  const chosen = (input.assigneeIds ?? []).filter((id) => allowed.has(id));

  const assignees = chosen.map((id) => {
    const u = allowed.get(id);
    return newAssignee({ id: u.id, name: u.name, role: u.role });
  });

  const ts = now();
  const title = input.title.trim();
  const id = crypto.randomUUID();
  const names = assignees.map((a) => a.name).join(", ");

  const task = {
    id,
    key: `${keyPrefix(title)}-${keyNum(id)}`,
    title,
    description: cleanHtml(input.description),
    priority: input.priority,
    dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
    recurrence: null,
    recurrenceParentId: null,
    nextRunAt: null,
    cancelled: false,
    cancelledAt: null,
    assignerId: actor.id,
    assignerName: actor.name,
    assignerRole: actor.role,
    assignees,
    subtasks: [],
    comments: [],
    attachments: (input.attachments ?? []).map((a) => buildAttachment(actor, a)),
    activity: [
      activity(
        actor,
        !assignees.length
          ? "created this task as a draft"
          : `created this task and assigned it to ${names}`
      ),
    ],
    createdAt: ts,
    updatedAt: ts,
  };

  await saveTask(task);

  // Notify assignees, including the actor if they assigned themselves
  // (best-effort, after the response is sent — never blocks the save).
  const recipients = assignees.map((a) => ({
    id: a.id,
    email: allowed.get(a.id)?.email,
    name: a.name,
  }));
  if (recipients.length) {
    after(() => sendAssignmentNotifications(actor, task, recipients));
  }

  return viewTask(actor, task);
}

export async function updateTask(
  actor,
  id,
  input
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canEdit(actor, task)) {
    throw new AppError("You are not allowed to edit this task.", 403);
  }
  if (deriveTaskStatus(task) === "completed") {
    throw new AppError("Completed tasks cannot be edited. Reopen it first.", 400);
  }

  if (input.title !== undefined) task.title = input.title.trim();
  if (input.description !== undefined) task.description = cleanHtml(input.description);
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.dueDate !== undefined) {
    const next = input.dueDate ? new Date(input.dueDate).toISOString() : null;
    // Only the creator reaches here (canEdit above). Record the change in the
    // audit log so the team can see who moved the deadline and to when.
    if (next !== task.dueDate) {
      const fmt = (d) => (d ? d.slice(0, 10) : "no due date");
      task.activity.push(
        activity(
          actor,
          `changed the due date from ${fmt(task.dueDate)} to ${fmt(next)}`
        )
      );
      task.dueDate = next;
      // A moved deadline should be able to trigger a fresh "due soon" reminder.
      for (const a of task.assignees) a.dueSoonNotified = false;
    }
  }
  const addedEmails = [];
  if (input.assigneeIds !== undefined) {
    const assignable = await listAssignableTaskUsers(actor);
    const allowed = new Map(assignable.map((u) => [u.id, u]));
    // Empty list is allowed — the task drops back to a draft.
    const chosen = input.assigneeIds.filter((x) => allowed.has(x));
    const existing = new Map(task.assignees.map((a) => [a.id, a]));
    task.assignees = chosen.map((cid) => {
      const cur = existing.get(cid);
      if (cur) return cur;
      const u = allowed.get(cid);
      addedEmails.push({ id: u.id, email: u.email, name: u.name });
      return newAssignee({ id: u.id, name: u.name, role: u.role });
    });
    task.activity.push(
      activity(
        actor,
        chosen.length ? "updated the assignees" : "moved this task back to a draft"
      )
    );
  }

  task.updatedAt = now();
  await saveTask(task);

  if (addedEmails.length) {
    after(() => sendAssignmentNotifications(actor, task, addedEmails));
  }

  return viewTask(actor, task);
}

export async function deleteTask(
  actor,
  id
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canDeleteTask(actor, task)) {
    throw new AppError("You are not allowed to delete this task.", 403);
  }
  // Collect every Cloudinary asset this task owns — task-level attachments plus
  // any attached to comments — so they don't leak in storage once the doc is gone.
  const assets = [
    ...(task.attachments || []),
    ...(task.comments || []).flatMap((c) => c.attachments || []),
  ].filter((a) => a && a.publicId);
  await Task.deleteOne({ id });
  if (assets.length) {
    after(() =>
      Promise.allSettled(
        assets.map((a) => destroyAsset(a.publicId, a.resourceType))
      )
    );
  }
}

export async function addComment(
  actor,
  id,
  text,
  parentId,
  attachments,
  mentions
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canSeeTask(actor, task)) {
    throw new AppError("You are not allowed to comment on this task.", 403);
  }

  const clean = cleanHtml(text);
  const atts = (attachments ?? []).map((a) => buildAttachment(actor, a));
  if (!clean && atts.length === 0) {
    throw new AppError("Comment cannot be empty.", 400);
  }

  if (parentId && !task.comments.some((c) => c.id === parentId)) {
    throw new AppError("The comment you replied to no longer exists.", 400);
  }

  // @mentions can only name people who are on the task (its creator or an
  // assignee). When the task creator mentions someone the comment becomes
  // private — visible only to the creator, the mentioned people and management
  // reviewers (see canSeeComment) — and must be a real message (≥ 50 chars).
  const participantIds = new Set([
    task.assignerId,
    ...task.assignees.map((a) => a.id),
  ]);
  const mentionIds = [...new Set(mentions ?? [])].filter((mid) =>
    participantIds.has(mid)
  );
  if (mentionIds.length > 0 && plainTextLength(clean) < 50) {
    throw new AppError(
      "A comment that mentions someone must be at least 50 characters.",
      400
    );
  }
  const isPrivate = actor.id === task.assignerId && mentionIds.length > 0;

  task.comments.push({
    id: crypto.randomUUID(),
    authorId: actor.id,
    authorName: actor.name,
    text: clean,
    kind: "comment",
    parentId: parentId ?? null,
    attachments: atts,
    mentions: mentionIds,
    visibility: isPrivate ? "private" : "public",
    audienceIds: isPrivate ? mentionIds : [],
    createdAt: now(),
  });
  task.updatedAt = now();
  await saveTask(task);

  // Notify mentioned people (best-effort, after the response is sent).
  if (mentionIds.length > 0) {
    after(async () => {
      const recipients = await Promise.all(
        mentionIds.map((mid) => store.findById(mid))
      );
      await Promise.allSettled(
        recipients
          .filter((u) => u && u.id !== actor.id && u.email)
          .map((u) =>
            emailMention({
              to: u.email,
              mentionedName: u.name,
              byName: actor.name,
              taskTitle: task.title,
              taskId: task.id,
            })
          )
      );
    });
  }

  return viewTask(actor, task);
}

// ── Attachments ────────────────────────────────────────────────────
export async function addTaskAttachment(
  actor,
  id,
  input
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canSeeTask(actor, task)) {
    throw new AppError("You are not allowed to attach files here.", 403);
  }
  task.attachments.push(buildAttachment(actor, input));
  task.activity.push(activity(actor, `attached "${input.name}"`));
  task.updatedAt = now();
  await saveTask(task);
  return viewTask(actor, task);
}

export async function removeTaskAttachment(
  actor,
  id,
  attachmentId
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);

  const att = task.attachments.find((a) => a.id === attachmentId);
  if (!att) throw new AppError("Attachment not found.", 404);

  // Uploader or a task manager can remove it.
  if (att.uploadedById !== actor.id && !canEdit(actor, task)) {
    throw new AppError("You can't remove this attachment.", 403);
  }

  task.attachments = task.attachments.filter((a) => a.id !== attachmentId);
  task.updatedAt = now();
  await saveTask(task);
  await destroyAsset(att.publicId, att.resourceType);
  return viewTask(actor, task);
}

// ── Subtasks (one level deep) ──────────────────────────────────────
export async function addSubtask(
  actor,
  taskId,
  input
) {
  const task = await rawById(taskId);
  if (!task) throw new AppError("Task not found.", 404);
  if (!isInvolved(actor, task)) {
    throw new AppError("Only people on this task can add subtasks.", 403);
  }

  let assigneeId = null;
  let assigneeName = "";
  let assigneeUser = null;
  if (input.assigneeId) {
    const assignable = await listAssignableTaskUsers(actor);
    const u = assignable.find((x) => x.id === input.assigneeId);
    if (!u) throw new AppError("You cannot assign to that person.", 403);
    assigneeId = u.id;
    assigneeName = u.name;
    assigneeUser = u;
  }

  const seq = nextSubKeyNum(task);
  task.subSeq = seq;
  const sub = {
    id: crypto.randomUUID(),
    key: `SB-${seq}`,
    title: input.title.trim(),
    description: cleanHtml(input.description),
    priority: input.priority ?? "medium",
    assigneeId,
    assigneeName,
    // Who raised the subtask — only they (or the task creator / a manager) may
    // approve it once it's submitted for review.
    createdById: actor.id,
    createdByName: actor.name,
    expectedDate: input.expectedDate
      ? new Date(input.expectedDate).toISOString()
      : null,
    status: "todo",
    submittedAt: null,
    createdAt: now(),
    completedAt: null,
  };
  task.subtasks.push(sub);
  task.activity.push(activity(actor, `added subtask "${sub.title}"`));
  task.updatedAt = now();
  await saveTask(task);

  // Notify the assignee, including the actor if they assigned themselves
  // (best-effort, after the response — never blocks the save).
  if (assigneeUser) {
    after(() =>
      Promise.allSettled([
        emailSubtaskAssigned({
          to: assigneeUser.email,
          assigneeName: assigneeUser.name,
          subtaskTitle: sub.title,
          taskTitle: task.title,
          assignerName: actor.name,
          taskId: task.id,
          subtaskKey: sub.key,
        }),
        pushSubtaskAssigned({
          userId: assigneeUser.id,
          subtaskTitle: sub.title,
          taskTitle: task.title,
          assignerName: actor.name,
          taskId: task.id,
          subtaskKey: sub.key,
        }),
      ])
    );
  }

  return viewTask(actor, task);
}

export async function updateSubtask(
  actor,
  taskId,
  subId,
  input
) {
  const task = await rawById(taskId);
  if (!task) throw new AppError("Task not found.", 404);
  const sub = task.subtasks.find((s) => s.id === subId);
  if (!sub) throw new AppError("Subtask not found.", 404);

  const involved = isInvolved(actor, task);
  const isSubAssignee = sub.assigneeId === actor.id;
  // Who may reschedule this subtask's due date: whoever raised it, the parent
  // task's creator, or a manager — never just the assignee. Mirrors canEdit
  // on tasks (only the assigner/manager moves the deadline).
  const subCreatorId = sub.createdById || task.assignerId;
  const subReviewer = actor.id === subCreatorId || canReviewTask(actor, task);
  // Set when the assignee is changed to someone new, so we can email them below.
  let notifyUser = null;
  // Set by the status transition below, consumed in the after() block further down.
  let notifySubtaskSubmit = null; // { subCreatorId }
  let notifySubtaskApprovedTo = null; // sub.assigneeId
  let notifySubtaskReturnedTo = null; // sub.assigneeId

  // Subtask review workflow (mirrors tasks): the assignee works it
  // (todo → in_progress) and submits it (→ submitted); only the subtask's
  // creator — or the task creator / a manager — approves it (→ done) or sends it
  // back (→ in_progress). The assignee can't close their own subtask.
  if (input.status !== undefined && input.status !== sub.status) {
    const target = input.status;
    const prevStatus = sub.status;
    if (target === "done") {
      if (!subReviewer) {
        throw new AppError("Only the subtask's creator can approve and close it.", 403);
      }
    } else if (target === "submitted") {
      if (!isSubAssignee && !subReviewer) {
        throw new AppError("Only the assignee can submit this subtask for review.", 403);
      }
    } else if (!isSubAssignee && !subReviewer && !involved) {
      throw new AppError("You cannot update this subtask.", 403);
    }
    sub.status = target;
    if (target === "submitted") sub.submittedAt = now();
    sub.completedAt = target === "done" ? now() : null;
    const verb =
      target === "submitted"
        ? `submitted subtask "${sub.title}" for review`
        : target === "done"
          ? `approved subtask "${sub.title}"`
          : `marked subtask "${sub.title}" as ${target}`;
    task.activity.push(activity(actor, verb));

    if (target === "submitted") {
      notifySubtaskSubmit = { subCreatorId };
    } else if (target === "done") {
      if (sub.assigneeId && sub.assigneeId !== actor.id) {
        notifySubtaskApprovedTo = sub.assigneeId;
      }
    } else if (target === "in_progress" && prevStatus === "submitted") {
      if (sub.assigneeId && sub.assigneeId !== actor.id) {
        notifySubtaskReturnedTo = sub.assigneeId;
      }
    }
  }

  // Title / assignee / expected date can be edited by anyone involved in the
  // task. Assignment is still bounded by the actor's own authority below.
  const wantsMeta =
    input.title !== undefined ||
    input.description !== undefined ||
    input.priority !== undefined ||
    input.assigneeId !== undefined ||
    input.expectedDate !== undefined;
  if (wantsMeta) {
    if (!involved) {
      throw new AppError("Only people on this task can edit subtask details.", 403);
    }
    // The due date is the one field the assignee can't move themselves —
    // only whoever raised the subtask, the task creator, or a manager can.
    if (input.expectedDate !== undefined && !subReviewer) {
      throw new AppError(
        "Only the subtask's creator or a manager can change its due date.",
        403
      );
    }
    if (input.title !== undefined) sub.title = input.title.trim();
    if (input.description !== undefined) sub.description = cleanHtml(input.description);
    if (input.priority !== undefined) sub.priority = input.priority;
    if (input.expectedDate !== undefined) {
      sub.expectedDate = input.expectedDate
        ? new Date(input.expectedDate).toISOString()
        : null;
      // A moved deadline should be able to trigger a fresh "due soon" reminder.
      sub.dueSoonNotified = false;
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId === "") {
        sub.assigneeId = null;
        sub.assigneeName = "";
      } else {
        const assignable = await listAssignableTaskUsers(actor);
        const u = assignable.find((x) => x.id === input.assigneeId);
        if (!u) throw new AppError("You cannot assign to that person.", 403);
        // Only notify when this is a genuinely new assignee (not a no-op re-save).
        if (sub.assigneeId !== u.id) notifyUser = u;
        sub.assigneeId = u.id;
        sub.assigneeName = u.name;
      }
    }
  }

  task.updatedAt = now();
  await saveTask(task);

  // Notify the newly assigned person (best-effort, after the response is sent).
  if (notifyUser) {
    after(() =>
      Promise.allSettled([
        emailSubtaskAssigned({
          to: notifyUser.email,
          assigneeName: notifyUser.name,
          subtaskTitle: sub.title,
          taskTitle: task.title,
          assignerName: actor.name,
          taskId: task.id,
          subtaskKey: sub.key,
        }),
        pushSubtaskAssigned({
          userId: notifyUser.id,
          subtaskTitle: sub.title,
          taskTitle: task.title,
          assignerName: actor.name,
          taskId: task.id,
          subtaskKey: sub.key,
        }),
      ])
    );
  }

  // Subtask review-lifecycle notifications — submitted (to its reviewers +
  // oversight), approved / sent back (to its assignee). Best-effort.
  if (notifySubtaskSubmit || notifySubtaskApprovedTo || notifySubtaskReturnedTo) {
    after(async () => {
      try {
        if (notifySubtaskSubmit) {
          const seen = new Set([actor.id]);
          const direct = [];
          for (const id of new Set([notifySubtaskSubmit.subCreatorId, task.assignerId])) {
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const u = await store.findById(id);
            if (u) direct.push(u);
          }
          const recipients = [...direct, ...(await oversightRecipients(seen))];
          await Promise.allSettled(
            recipients.flatMap((r) => [
              r.email &&
                emailSubtaskSubmitted({
                  to: r.email,
                  recipientName: r.name,
                  byName: actor.name,
                  subtaskTitle: sub.title,
                  taskTitle: task.title,
                  taskId: task.id,
                  subtaskKey: sub.key,
                }),
              pushSubtaskSubmitted({
                userId: r.id,
                subtaskTitle: sub.title,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
                subtaskKey: sub.key,
              }),
            ]).filter(Boolean)
          );
        }
        if (notifySubtaskApprovedTo) {
          const u = await store.findById(notifySubtaskApprovedTo);
          if (u) {
            await Promise.allSettled([
              u.email &&
                emailSubtaskApproved({
                  to: u.email,
                  assigneeName: u.name,
                  byName: actor.name,
                  subtaskTitle: sub.title,
                  taskTitle: task.title,
                  taskId: task.id,
                  subtaskKey: sub.key,
                }),
              pushSubtaskApproved({
                userId: u.id,
                subtaskTitle: sub.title,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
                subtaskKey: sub.key,
              }),
            ]);
          }
        }
        if (notifySubtaskReturnedTo) {
          const u = await store.findById(notifySubtaskReturnedTo);
          if (u) {
            await Promise.allSettled([
              u.email &&
                emailSubtaskReturned({
                  to: u.email,
                  assigneeName: u.name,
                  byName: actor.name,
                  subtaskTitle: sub.title,
                  taskTitle: task.title,
                  taskId: task.id,
                  subtaskKey: sub.key,
                }),
              pushSubtaskReturned({
                userId: u.id,
                subtaskTitle: sub.title,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
                subtaskKey: sub.key,
              }),
            ]);
          }
        }
      } catch (err) {
        console.error("Subtask notification failed:", err);
      }
    });
  }

  return viewTask(actor, task);
}

export async function deleteSubtask(
  actor,
  taskId,
  subId
) {
  const task = await rawById(taskId);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canEdit(actor, task)) {
    throw new AppError("Only the task owner can delete subtasks.", 403);
  }
  task.subtasks = task.subtasks.filter((s) => s.id !== subId);
  task.updatedAt = now();
  await saveTask(task);
  return viewTask(actor, task);
}

export async function transitionTask(
  actor,
  id,
  input
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canSeeTask(actor, task)) {
    throw new AppError("You are not allowed to act on this task.", 403);
  }

  const mine = task.assignees.find((a) => a.id === actor.id);
  const wasCompleted = deriveTaskStatus(task) === "completed";
  const reviewer = canReviewTask(actor, task);

  // Set after the switch so the relevant email fires once, after the response.
  let notifySubmitTo = null; // assigner id — work was submitted for review
  let notifyReturnTo = null; // { id, reason } — a submission was sent back
  let notifyApprovedTo = null; // assignee id — their individual submission was approved

  const pushComment = (text, kind, extra = {}) => {
    task.comments.push({
      id: crypto.randomUUID(),
      authorId: actor.id,
      authorName: actor.name,
      text: cleanHtml(text),
      kind,
      parentId: null,
      attachments: [],
      mentions: [],
      visibility: "public",
      audienceIds: [],
      createdAt: now(),
      ...extra,
    });
  };

  switch (input.action) {
    case "start": {
      if (!mine || mine.status === "completed" || mine.status === "submitted") {
        throw new AppError("You cannot start this task right now.", 400);
      }
      mine.status = "in_progress";
      task.activity.push(activity(actor, "started work"));
      break;
    }
    // Assignees no longer close their own work — they submit it for review with
    // a note (required) and optional private files; the assigner is notified.
    case "submit": {
      if (!mine || mine.status === "completed" || mine.status === "submitted") {
        throw new AppError("You cannot submit this task right now.", 400);
      }
      // A task can only go up for review once all its subtasks are closed.
      if ((task.subtasks || []).some((s) => s.status !== "done")) {
        throw new AppError(
          "Close all subtasks before submitting this task for review.",
          400
        );
      }
      const note = cleanHtml(input.note);
      if (plainTextLength(note) === 0) {
        throw new AppError("Add a short note describing what you're submitting.", 400);
      }
      const atts = (input.attachments ?? []).map((a) => buildAttachment(actor, a));
      mine.status = "submitted";
      mine.submittedAt = now();
      // The submission (note + files) is private: only the submitter, the task
      // creator and management reviewers can see it (see canSeeComment).
      pushComment(input.note, "submission", {
        attachments: atts,
        visibility: "private",
        audienceIds: [task.assignerId],
      });
      task.activity.push(activity(actor, "submitted their part for review"));
      notifySubmitTo = task.assignerId;
      break;
    }
    // Reviewer (task creator or a manager) approves a submitted part → completed.
    case "approve": {
      if (!reviewer) {
        throw new AppError("Only the task creator or a manager can approve work.", 403);
      }
      const target = task.assignees.find((a) => a.id === input.assigneeId);
      if (!target) throw new AppError("Choose whose submission to approve.", 400);
      if (target.status !== "submitted") {
        throw new AppError("That person hasn't submitted work to approve.", 400);
      }
      target.status = "completed";
      target.completedAt = now();
      if (input.note) pushComment(input.note, "feedback");
      task.activity.push(activity(actor, `approved ${target.name}'s submission`));
      if (target.id !== actor.id) {
        notifyApprovedTo = target.id;
      }
      break;
    }
    // Reviewer sends a submitted part back for changes → in_progress.
    case "sendback": {
      if (!reviewer) {
        throw new AppError("Only the task creator or a manager can send work back.", 403);
      }
      const target = task.assignees.find((a) => a.id === input.assigneeId);
      if (!target) throw new AppError("Choose whose submission to send back.", 400);
      if (target.status !== "submitted") {
        throw new AppError("That person hasn't submitted work to send back.", 400);
      }
      target.status = "in_progress";
      target.completedAt = null;
      if (input.note) pushComment(input.note, "feedback");
      task.activity.push(
        activity(actor, `sent ${target.name}'s submission back for changes`)
      );
      if (target.id !== actor.id) {
        notifyReturnTo = { id: target.id, reason: input.note || "" };
      }
      break;
    }
    case "cancel": {
      if (!canControlTask(actor, task)) {
        throw new AppError("You cannot cancel this task.", 403);
      }
      if (task.cancelled) throw new AppError("This task is already cancelled.", 400);
      task.cancelled = true;
      task.cancelledAt = now();
      if (input.note) pushComment(input.note, "note");
      task.activity.push(activity(actor, "cancelled the task"));
      break;
    }
    case "reopen": {
      if (!canControlTask(actor, task)) {
        throw new AppError("You cannot reopen this task.", 403);
      }
      if (task.cancelled) {
        // Un-cancel only — restore the task exactly as it was, preserving each
        // assignee's status and completion history (don't reset anyone).
        task.cancelled = false;
        task.cancelledAt = null;
        task.activity.push(activity(actor, "reopened the cancelled task"));
      } else if (
        task.assignees.length > 0 &&
        task.assignees.every((a) => a.status === "completed")
      ) {
        // Reopening a finished task: there's no per-person open part left, so
        // bring everyone back to in-progress to make it active again.
        for (const a of task.assignees) {
          a.status = "in_progress";
          a.completedAt = null;
        }
        task.activity.push(activity(actor, "reopened the task for more work"));
      } else {
        throw new AppError("This task is already open.", 400);
      }
      break;
    }
    default:
      throw new AppError("Unknown action.", 400);
  }

  task.updatedAt = now();
  await saveTask(task);

  // All notifications are best-effort and run after the response is sent so they
  // never block the action: submitted-for-review (to the assigner + oversight),
  // sent-back (to the assignee), approved (to the assignee), and
  // whole-task-completed (to the creator + oversight).
  const nowCompleted = deriveTaskStatus(task) === "completed";
  const completedNow = !wasCompleted && nowCompleted;
  if (notifySubmitTo || notifyReturnTo || notifyApprovedTo || completedNow) {
    after(async () => {
      try {
        if (notifySubmitTo) {
          const seen = new Set([actor.id]);
          const creator =
            notifySubmitTo !== actor.id ? await store.findById(notifySubmitTo) : null;
          const recipients = creator ? [creator] : [];
          if (creator) seen.add(creator.id);
          recipients.push(...(await oversightRecipients(seen)));
          await Promise.allSettled(
            recipients.flatMap((r) => [
              r.email &&
                emailTaskSubmitted({
                  to: r.email,
                  creatorName: r.name,
                  byName: actor.name,
                  taskTitle: task.title,
                  taskId: task.id,
                }),
              pushTaskSubmitted({
                userId: r.id,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
              }),
            ]).filter(Boolean)
          );
        }
        if (notifyReturnTo) {
          const u = await store.findById(notifyReturnTo.id);
          if (u) {
            await Promise.allSettled([
              u.email &&
                emailSubmissionReturned({
                  to: u.email,
                  assigneeName: u.name,
                  byName: actor.name,
                  taskTitle: task.title,
                  taskId: task.id,
                  reason: notifyReturnTo.reason,
                }),
              pushSubmissionReturned({
                userId: u.id,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
              }),
            ]);
          }
        }
        if (notifyApprovedTo) {
          const u = await store.findById(notifyApprovedTo);
          if (u) {
            await Promise.allSettled([
              u.email &&
                emailTaskApproved({
                  to: u.email,
                  assigneeName: u.name,
                  byName: actor.name,
                  taskTitle: task.title,
                  taskId: task.id,
                }),
              pushTaskApproved({
                userId: u.id,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
              }),
            ]);
          }
        }
        if (completedNow) {
          const seen = new Set([actor.id]);
          const creator =
            task.assignerId !== actor.id ? await store.findById(task.assignerId) : null;
          const recipients = creator ? [creator] : [];
          if (creator) seen.add(creator.id);
          recipients.push(...(await oversightRecipients(seen)));
          await Promise.allSettled(
            recipients.flatMap((r) => [
              r.email &&
                emailTaskCompleted({
                  to: r.email,
                  creatorName: r.name,
                  taskTitle: task.title,
                  byName: actor.name,
                  taskId: task.id,
                }),
              pushTaskCompleted({
                userId: r.id,
                taskTitle: task.title,
                byName: actor.name,
                taskId: task.id,
              }),
            ]).filter(Boolean)
          );
        }
      } catch (err) {
        console.error("Task notification failed:", err);
      }
    });
  }

  return viewTask(actor, task);
}

// ── Delayed-task reminders ───────────────────────────────────────────
// Daily sweep (see /api/cron/delayed-tasks): emails + pushes every open
// assignee on a task or subtask that's now past its due date. Each
// assignee/subtask stamps the IST day it was last reminded (via a targeted
// array-element update, so it can't clobber an unrelated concurrent edit),
// so re-running the sweep the same day never double-sends. Best-effort —
// one bad doc doesn't abort the sweep.
export async function sendDelayedTaskReminders() {
  await connectToDatabase();
  const today = todayDayKey();
  const docs = await Task.find({ cancelled: false, dueDate: { $ne: null } })
    .lean()
    .exec();
  // Subtasks can be overdue even on a task with no due date of its own, so
  // also sweep every task that has at least one subtask with an expected date.
  const withSubtasks = await Task.find({
    cancelled: false,
    dueDate: null,
    "subtasks.0": { $exists: true },
  })
    .lean()
    .exec();

  let reminded = 0;
  const errors = [];
  for (const doc of [...docs, ...withSubtasks]) {
    try {
      const task = stripMongo(doc);
      normalizeTask(task);

      if (task.dueDate && deriveTaskStatus(task) === "delayed") {
        const daysLate = Math.max(
          1,
          Math.ceil((Date.now() - new Date(task.dueDate).getTime()) / DAY_MS)
        );
        for (const a of task.assignees) {
          if (a.status === "completed") continue;
          if (a.lastDelayReminderDay === today) continue;
          const u = await store.findById(a.id);
          if (!u) continue;
          await Promise.allSettled([
            u.email &&
              emailTaskDelayed({
                to: u.email,
                assigneeName: a.name,
                taskTitle: task.title,
                taskId: task.id,
                daysLate,
              }),
            pushTaskDelayed({ userId: a.id, taskTitle: task.title, taskId: task.id }),
          ]);
          await Task.updateOne(
            { id: task.id },
            { $set: { "assignees.$[el].lastDelayReminderDay": today } },
            { arrayFilters: [{ "el.id": a.id }] }
          );
          reminded++;
        }
      }

      for (const s of task.subtasks || []) {
        if (s.status === "done" || !s.expectedDate || !s.assigneeId) continue;
        if (new Date(s.expectedDate).getTime() >= Date.now()) continue;
        if (s.lastDelayReminderDay === today) continue;
        const u = await store.findById(s.assigneeId);
        if (!u) continue;
        const daysLate = Math.max(
          1,
          Math.ceil((Date.now() - new Date(s.expectedDate).getTime()) / DAY_MS)
        );
        await Promise.allSettled([
          u.email &&
            emailSubtaskDelayed({
              to: u.email,
              assigneeName: s.assigneeName,
              subtaskTitle: s.title,
              taskTitle: task.title,
              taskId: task.id,
              subtaskKey: s.key,
              daysLate,
            }),
          pushSubtaskDelayed({
            userId: s.assigneeId,
            subtaskTitle: s.title,
            taskTitle: task.title,
            taskId: task.id,
            subtaskKey: s.key,
          }),
        ]);
        await Task.updateOne(
          { id: task.id },
          { $set: { "subtasks.$[el].lastDelayReminderDay": today } },
          { arrayFilters: [{ "el.id": s.id }] }
        );
        reminded++;
      }
    } catch (err) {
      errors.push({ id: doc.id, error: err?.message || String(err) });
    }
  }
  return { reminded, considered: docs.length + withSubtasks.length, errors };
}

/** "38 minutes" / "1 hour" — the time-left label used in due-soon notifications. */
function formatDueIn(msLeft) {
  const mins = Math.max(1, Math.round(msLeft / 60_000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// ── Upcoming-deadline reminders ───────────────────────────────────────
// Frequent sweep (see /api/cron/reminders): emails + pushes every open
// assignee on a task or subtask whose deadline falls within the next
// DUE_SOON_WINDOW_MS and hasn't been submitted yet — a heads-up before it
// tips over into "delayed". Each assignee/subtask stamps a `dueSoonNotified`
// flag (via a targeted array-element update) so it only ever fires once per
// deadline; moving the due date clears the flag (see updateTask/updateSubtask).
// Best-effort — one bad doc doesn't abort the sweep.
export async function sendUpcomingDueReminders() {
  await connectToDatabase();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowEndIso = new Date(nowMs + DUE_SOON_WINDOW_MS).toISOString();

  const docs = await Task.find({
    cancelled: false,
    dueDate: { $gt: nowIso, $lte: windowEndIso },
  })
    .lean()
    .exec();
  const withSubtasks = await Task.find({
    cancelled: false,
    "subtasks.expectedDate": { $gt: nowIso, $lte: windowEndIso },
  })
    .lean()
    .exec();

  const seen = new Set();
  let reminded = 0;
  const errors = [];
  for (const doc of [...docs, ...withSubtasks]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    try {
      const task = stripMongo(doc);
      normalizeTask(task);

      if (task.dueDate) {
        const msLeft = new Date(task.dueDate).getTime() - nowMs;
        if (msLeft > 0 && msLeft <= DUE_SOON_WINDOW_MS) {
          const dueInLabel = formatDueIn(msLeft);
          for (const a of task.assignees) {
            if (a.status === "completed" || a.status === "submitted") continue;
            if (a.dueSoonNotified) continue;
            const u = await store.findById(a.id);
            if (!u) continue;
            await Promise.allSettled([
              u.email &&
                emailTaskDueSoon({
                  to: u.email,
                  assigneeName: a.name,
                  taskTitle: task.title,
                  taskId: task.id,
                  dueInLabel,
                }),
              pushTaskDueSoon({
                userId: a.id,
                taskTitle: task.title,
                taskId: task.id,
                dueInLabel,
              }),
            ]);
            await Task.updateOne(
              { id: task.id },
              { $set: { "assignees.$[el].dueSoonNotified": true } },
              { arrayFilters: [{ "el.id": a.id }] }
            );
            reminded++;
          }
        }
      }

      for (const s of task.subtasks || []) {
        if (s.status === "done" || s.status === "submitted") continue;
        if (!s.expectedDate || !s.assigneeId) continue;
        if (s.dueSoonNotified) continue;
        const msLeft = new Date(s.expectedDate).getTime() - nowMs;
        if (msLeft <= 0 || msLeft > DUE_SOON_WINDOW_MS) continue;
        const u = await store.findById(s.assigneeId);
        if (!u) continue;
        const dueInLabel = formatDueIn(msLeft);
        await Promise.allSettled([
          u.email &&
            emailSubtaskDueSoon({
              to: u.email,
              assigneeName: s.assigneeName,
              subtaskTitle: s.title,
              taskTitle: task.title,
              taskId: task.id,
              subtaskKey: s.key,
              dueInLabel,
            }),
          pushSubtaskDueSoon({
            userId: s.assigneeId,
            subtaskTitle: s.title,
            taskTitle: task.title,
            taskId: task.id,
            subtaskKey: s.key,
            dueInLabel,
          }),
        ]);
        await Task.updateOne(
          { id: task.id },
          { $set: { "subtasks.$[el].dueSoonNotified": true } },
          { arrayFilters: [{ "el.id": s.id }] }
        );
        reminded++;
      }
    } catch (err) {
      errors.push({ id: doc.id, error: err?.message || String(err) });
    }
  }
  return { reminded, considered: seen.size, errors };
}
