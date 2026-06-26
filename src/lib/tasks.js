import crypto from "crypto";

import { after } from "next/server";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import { emailTaskAssigned, emailTaskCompleted } from "@/lib/email";
import { canManage, isOwner } from "@/lib/rbac";
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
  // Remember the version we read so saveTask can detect concurrent writes.
  Object.defineProperty(task, REV, {
    value: task.updatedAt ?? null,
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

// Optimistic concurrency: an existing task is only overwritten if its
// `updatedAt` still matches the value we read (REV). If another request changed
// (or deleted) it in between, the write is rejected with a 409 instead of
// silently clobbering their change. Brand-new tasks (no REV) are inserted.
async function saveTask(task) {
  await connectToDatabase();
  const prev = task[REV];
  if (prev === undefined) {
    // Never loaded from the DB → genuinely new document.
    await Task.replaceOne({ id: task.id }, task, { upsert: true });
    Object.defineProperty(task, REV, {
      value: task.updatedAt ?? null,
      writable: true,
      enumerable: false,
    });
    return;
  }
  const res = await Task.replaceOne(
    { id: task.id, updatedAt: prev },
    task
  );
  if (res.matchedCount === 0) {
    throw new AppError(
      "This task was changed by someone else. Refresh and try again.",
      409
    );
  }
  task[REV] = task.updatedAt ?? null;
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

// Only the creator (assigner) may edit/delete the task itself.
function canEdit(actor, task) {
  return actor.id === task.assignerId;
}

// ── Queries ────────────────────────────────────────────────────────
export async function listVisibleTasks(actor) {
  await connectToDatabase();
  const docs = await Task.find().lean();
  return docs
    .map((d) => {
      const t = stripMongo(d );
      normalizeTask(t);
      return t;
    })
    .filter((t) => canSeeTask(actor, t))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(toDTO);
}

export async function getTaskForActor(
  actor,
  id
) {
  const task = await rawById(id);
  if (!task) return null;
  if (!canSeeTask(actor, task)) return null;
  return toDTO(task);
}

 









export async function getTaskStats(actor) {
  const tasks = await listVisibleTasks(actor);
  const stats = {
    total: tasks.length,
    draft: 0,
    pending: 0,
    inProgress: 0,
    delayed: 0,
    completed: 0,
    cancelled: 0,
    assignedToMe: 0,
  };
  for (const t of tasks) {
    if (t.status === "draft") stats.draft += 1;
    else if (t.status === "assigned") stats.pending += 1;
    else if (t.status === "in_progress") stats.inProgress += 1;
    else if (t.status === "delayed") stats.delayed += 1;
    else if (t.status === "completed") stats.completed += 1;
    else if (t.status === "cancelled") stats.cancelled += 1;
    if (t.assignees.some((a) => a.id === actor.id)) stats.assignedToMe += 1;
  }
  return stats;
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
      completionRate: e.assigned ? Math.round((e.completed / e.assigned) * 100) : 0,
    }))
    .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned);

  // Org totals over real (assigned, non-draft, non-cancelled) tasks.
  const active = tasks.filter(
    (t) => t.status !== "draft" && t.status !== "cancelled"
  );
  const completedTasks = active.filter((t) => t.status === "completed").length;
  const delayedTasks = active.filter((t) => t.status === "delayed").length;

  return {
    totalAssigned: active.length,
    completedTasks,
    delayedTasks,
    notCompleted: active.length - completedTasks,
    completionRate: active.length
      ? Math.round((completedTasks / active.length) * 100)
      : 0,
    perUser,
  };
}

// ── Mutations ──────────────────────────────────────────────────────
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
    cancelled: false,
    cancelledAt: null,
    assignerId: actor.id,
    assignerName: actor.name,
    assignerRole: actor.role,
    assignees,
    subtasks: [],
    comments: [],
    attachments: [],
    activity: [
      activity(
        actor,
        assignees.length
          ? `created this task and assigned it to ${names}`
          : "created this task as a draft"
      ),
    ],
    createdAt: ts,
    updatedAt: ts,
  };

  await saveTask(task);

  // Notify assignees (best-effort, after the response is sent — never blocks the save).
  const recipients = assignees
    .filter((a) => a.id !== actor.id)
    .map((a) => ({ user: allowed.get(a.id), name: a.name }))
    .filter((r) => r.user);
  if (recipients.length) {
    after(() =>
      Promise.allSettled(
        recipients.map((r) =>
          emailTaskAssigned({
            to: r.user.email,
            assigneeName: r.name,
            taskTitle: task.title,
            assignerName: actor.name,
            taskId: task.id,
          })
        )
      )
    );
  }

  return toDTO(task);
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
      if (u.id !== actor.id) addedEmails.push({ to: u.email, name: u.name });
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
    after(() =>
      Promise.allSettled(
        addedEmails.map((r) =>
          emailTaskAssigned({
            to: r.to,
            assigneeName: r.name,
            taskTitle: task.title,
            assignerName: actor.name,
            taskId: task.id,
          })
        )
      )
    );
  }

  return toDTO(task);
}

export async function deleteTask(
  actor,
  id
) {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canEdit(actor, task)) {
    throw new AppError("You are not allowed to delete this task.", 403);
  }
  await Task.deleteOne({ id });
}

export async function addComment(
  actor,
  id,
  text,
  parentId,
  attachments
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

  task.comments.push({
    id: crypto.randomUUID(),
    authorId: actor.id,
    authorName: actor.name,
    text: clean,
    kind: "comment",
    parentId: parentId ?? null,
    attachments: atts,
    createdAt: now(),
  });
  task.updatedAt = now();
  await saveTask(task);
  return toDTO(task);
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
  return toDTO(task);
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
  return toDTO(task);
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
  if (input.assigneeId) {
    const assignable = await listAssignableTaskUsers(actor);
    const u = assignable.find((x) => x.id === input.assigneeId);
    if (!u) throw new AppError("You cannot assign to that person.", 403);
    assigneeId = u.id;
    assigneeName = u.name;
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
    expectedDate: input.expectedDate
      ? new Date(input.expectedDate).toISOString()
      : null,
    status: "todo",
    createdAt: now(),
    completedAt: null,
  };
  task.subtasks.push(sub);
  task.activity.push(activity(actor, `added subtask "${sub.title}"`));
  task.updatedAt = now();
  await saveTask(task);
  return toDTO(task);
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

  // Status can be changed by anyone involved in the task or the subtask's own
  // assignee (who may not otherwise be on the task).
  if (input.status !== undefined) {
    if (!involved && !isSubAssignee) {
      throw new AppError("You cannot update this subtask.", 403);
    }
    sub.status = input.status;
    sub.completedAt = input.status === "done" ? now() : null;
    task.activity.push(
      activity(actor, `marked subtask "${sub.title}" as ${input.status}`)
    );
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
    if (input.title !== undefined) sub.title = input.title.trim();
    if (input.description !== undefined) sub.description = cleanHtml(input.description);
    if (input.priority !== undefined) sub.priority = input.priority;
    if (input.expectedDate !== undefined) {
      sub.expectedDate = input.expectedDate
        ? new Date(input.expectedDate).toISOString()
        : null;
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId === "") {
        sub.assigneeId = null;
        sub.assigneeName = "";
      } else {
        const assignable = await listAssignableTaskUsers(actor);
        const u = assignable.find((x) => x.id === input.assigneeId);
        if (!u) throw new AppError("You cannot assign to that person.", 403);
        sub.assigneeId = u.id;
        sub.assigneeName = u.name;
      }
    }
  }

  task.updatedAt = now();
  await saveTask(task);
  return toDTO(task);
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
  return toDTO(task);
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

  const pushComment = (text, kind) => {
    task.comments.push({
      id: crypto.randomUUID(),
      authorId: actor.id,
      authorName: actor.name,
      text: cleanHtml(text),
      kind,
      parentId: null,
      attachments: [],
      createdAt: now(),
    });
  };

  switch (input.action) {
    case "start": {
      if (!mine || mine.status === "completed") {
        throw new AppError("You cannot start this task right now.", 400);
      }
      mine.status = "in_progress";
      task.activity.push(activity(actor, "started work"));
      break;
    }
    case "complete": {
      if (!mine || mine.status === "completed") {
        throw new AppError("You cannot complete this task right now.", 400);
      }
      mine.status = "completed";
      mine.completedAt = now();
      if (input.note) pushComment(input.note, "note");
      task.activity.push(activity(actor, "marked their part complete"));
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

  // Notify the creator when the whole task becomes completed
  // (best-effort, after the response is sent — never blocks the action).
  const nowCompleted = deriveTaskStatus(task) === "completed";
  if (!wasCompleted && nowCompleted) {
    after(async () => {
      try {
        const creator = await store.findById(task.assignerId);
        if (creator && creator.id !== actor.id) {
          await emailTaskCompleted({
            to: creator.email,
            creatorName: creator.name,
            taskTitle: task.title,
            byName: actor.name,
            taskId: task.id,
          });
        }
      } catch (err) {
        console.error("Task notification failed:", err);
      }
    });
  }

  return toDTO(task);
}
