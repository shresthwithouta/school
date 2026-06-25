import crypto from "crypto";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import {
  emailTaskApproved,
  emailTaskAssigned,
  emailTaskSubmitted,
} from "@/lib/email";
import { isOwner } from "@/lib/rbac";
import { store } from "@/lib/store";
import { listVisibleUsers } from "@/lib/users";
import { destroyAsset } from "@/lib/cloudinary";


import Task from "@/models/Task";














 











































































// ── Persistence (MongoDB) ──────────────────────────────────────────
async function rawById(id) {
  await connectToDatabase();
  const doc = await Task.findOne({ id }).lean();
  if (!doc) return null;
  const task = stripMongo(doc );
  normalizeTask(task);
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

async function saveTask(task) {
  await connectToDatabase();
  await Task.replaceOne({ id: task.id }, task, { upsert: true });
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
    progress: 0,
    evaluation: null,
    acceptedAt: null,
    submittedAt: null,
    completedAt: null,
  };
}

// ── Derived task-level values ──────────────────────────────────────
function deriveStatus(assignees) {
  if (assignees.length === 0) return "assigned";
  if (assignees.every((a) => a.status === "completed")) return "completed";
  if (assignees.some((a) => a.status === "submitted")) return "submitted";
  if (
    assignees.some(
      (a) =>
        a.status === "accepted" ||
        a.status === "in_progress" ||
        a.status === "completed"
    )
  )
    return "in_progress";
  return "assigned";
}

function deriveProgress(assignees) {
  if (assignees.length === 0) return 0;
  const sum = assignees.reduce(
    (s, a) => s + (a.status === "completed" ? 100 : a.progress),
    0
  );
  return Math.round(sum / assignees.length);
}

function toDTO(t) {
  const status = deriveStatus(t.assignees);
  const overdue =
    !!t.dueDate &&
    status !== "completed" &&
    new Date(t.dueDate).getTime() < Date.now();
  return { ...t, status, progress: deriveProgress(t.assignees), overdue };
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
async function visibleUserIds(actor) {
  const users = await listVisibleUsers(actor);
  return new Set(users.map((u) => u.id));
}

function canSee(task, ids) {
  return ids.has(task.assignerId) || task.assignees.some((a) => ids.has(a.id));
}

function canReview(actor, task) {
  return actor.id === task.assignerId || isOwner(actor.role);
}

// Only the creator (assigner) may edit/delete the task and its subtasks.
function canEdit(actor, task) {
  return actor.id === task.assignerId;
}

// ── Queries ────────────────────────────────────────────────────────
export async function listVisibleTasks(actor) {
  const ids = await visibleUserIds(actor);
  await connectToDatabase();
  const docs = await Task.find().lean();
  return docs
    .map((d) => {
      const t = stripMongo(d );
      normalizeTask(t);
      return t;
    })
    .filter((t) => canSee(t, ids))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(toDTO);
}

export async function getTaskForActor(
  actor,
  id
) {
  const task = await rawById(id);
  if (!task) return null;
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) return null;
  return toDTO(task);
}

 









export async function getTaskStats(actor) {
  const tasks = await listVisibleTasks(actor);
  const stats = {
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    inReview: 0,
    completed: 0,
    overdue: 0,
    assignedToMe: 0,
  };
  for (const t of tasks) {
    if (t.status === "assigned") stats.pending += 1;
    else if (t.status === "in_progress") stats.inProgress += 1;
    else if (t.status === "submitted") stats.inReview += 1;
    else if (t.status === "completed") stats.completed += 1;
    if (t.overdue) stats.overdue += 1;
    if (t.assignees.some((a) => a.id === actor.id)) stats.assignedToMe += 1;
  }
  return stats;
}

// ── Analytics ──────────────────────────────────────────────────────
 





















export async function getTaskAnalytics(actor) {
  const tasks = await listVisibleTasks(actor);

  











  const map = new Map();

  for (const t of tasks) {
    for (const a of t.assignees) {
      const e =
        map.get(a.id) ?? {
          name: a.name,
          role: a.role,
          assigned: 0,
          completed: 0,
          inProgress: 0,
          overdue: 0,
          hoursSum: 0,
          hoursCount: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
      e.assigned += 1;
      if (a.status === "completed") {
        e.completed += 1;
        if (a.completedAt) {
          const start = a.acceptedAt ?? t.createdAt;
          const hrs =
            (new Date(a.completedAt).getTime() - new Date(start).getTime()) /
            3_600_000;
          if (hrs >= 0) {
            e.hoursSum += hrs;
            e.hoursCount += 1;
          }
        }
        if (a.evaluation) {
          e.ratingSum += a.evaluation.average;
          e.ratingCount += 1;
        }
      } else {
        if (a.status !== "assigned") e.inProgress += 1;
        if (t.overdue) e.overdue += 1;
      }
      map.set(a.id, e);
    }
  }

  const perUser = [...map.entries()]
    .map(([id, e]) => ({
      id,
      name: e.name,
      role: e.role,
      assigned: e.assigned,
      completed: e.completed,
      inProgress: e.inProgress,
      overdue: e.overdue,
      avgRating: e.ratingCount
        ? Math.round((e.ratingSum / e.ratingCount) * 10) / 10
        : null,
      avgHours: e.hoursCount
        ? Math.round((e.hoursSum / e.hoursCount) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned);

  let hSum = 0;
  let hCount = 0;
  for (const e of map.values()) {
    hSum += e.hoursSum;
    hCount += e.hoursCount;
  }

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = tasks.filter((t) =>
    ["accepted", "in_progress", "submitted"].includes(t.status)
  ).length;

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    overdueTasks: tasks.filter((t) => t.overdue).length,
    completionRate: tasks.length
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0,
    avgCompletionHours: hCount ? Math.round((hSum / hCount) * 10) / 10 : null,
    perUser,
  };
}

// ── Mutations ──────────────────────────────────────────────────────
export async function createTask(
  actor,
  input
) {
  const visible = await listVisibleUsers(actor);
  const allowed = new Map(visible.map((u) => [u.id, u]));
  const chosen = input.assigneeIds.filter((id) => allowed.has(id));
  if (chosen.length === 0) {
    throw new AppError("You can only assign people at or below your level.", 403);
  }

  const assignees = chosen.map((id) => {
    const u = allowed.get(id);
    return newAssignee({ id: u.id, name: u.name, role: u.role });
  });

  const ts = now();
  const names = assignees.map((a) => a.name).join(", ");
  const task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    description: cleanHtml(input.description),
    priority: input.priority,
    dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
    assignerId: actor.id,
    assignerName: actor.name,
    assignerRole: actor.role,
    assignees,
    subtasks: [],
    comments: [],
    attachments: [],
    activity: [activity(actor, `created this task and assigned it to ${names}`)],
    createdAt: ts,
    updatedAt: ts,
  };

  await saveTask(task);

  // Notify assignees (best-effort).
  await Promise.allSettled(
    assignees
      .filter((a) => a.id !== actor.id)
      .map((a) => {
        const u = allowed.get(a.id);
        return u
          ? emailTaskAssigned({
              to: u.email,
              assigneeName: a.name,
              taskTitle: task.title,
              assignerName: actor.name,
              taskId: task.id,
            })
          : Promise.resolve();
      })
  );

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
  if (deriveStatus(task.assignees) === "completed") {
    throw new AppError("Completed tasks cannot be edited.", 400);
  }

  if (input.title !== undefined) task.title = input.title.trim();
  if (input.description !== undefined) task.description = cleanHtml(input.description);
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.dueDate !== undefined) {
    task.dueDate = input.dueDate ? new Date(input.dueDate).toISOString() : null;
  }
  const addedEmails = [];
  if (input.assigneeIds !== undefined) {
    const visible = await listVisibleUsers(actor);
    const allowed = new Map(visible.map((u) => [u.id, u]));
    const chosen = input.assigneeIds.filter((x) => allowed.has(x));
    if (chosen.length === 0) {
      throw new AppError("You can only assign people at or below your level.", 403);
    }
    const existing = new Map(task.assignees.map((a) => [a.id, a]));
    task.assignees = chosen.map((cid) => {
      const cur = existing.get(cid);
      if (cur) return cur;
      const u = allowed.get(cid);
      if (u.id !== actor.id) addedEmails.push({ to: u.email, name: u.name });
      return newAssignee({ id: u.id, name: u.name, role: u.role });
    });
    task.activity.push(activity(actor, "updated the assignees"));
  }

  task.updatedAt = now();
  await saveTask(task);

  await Promise.allSettled(
    addedEmails.map((r) =>
      emailTaskAssigned({
        to: r.to,
        assigneeName: r.name,
        taskTitle: task.title,
        assignerName: actor.name,
        taskId: task.id,
      })
    )
  );

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
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) {
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
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) {
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
  if (!canEdit(actor, task)) {
    throw new AppError("Only the task owner can add subtasks.", 403);
  }

  let assigneeId = null;
  let assigneeName = "";
  if (input.assigneeId) {
    const visible = await listVisibleUsers(actor);
    const u = visible.find((x) => x.id === input.assigneeId);
    if (!u) throw new AppError("You cannot assign to that person.", 403);
    assigneeId = u.id;
    assigneeName = u.name;
  }

  const sub = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
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

  const manager = canEdit(actor, task);
  const isSubAssignee = sub.assigneeId === actor.id;

  // Status can be changed by the subtask's assignee or a manager.
  if (input.status !== undefined) {
    if (!manager && !isSubAssignee) {
      throw new AppError("You cannot update this subtask.", 403);
    }
    sub.status = input.status;
    sub.completedAt = input.status === "done" ? now() : null;
    task.activity.push(
      activity(actor, `marked subtask "${sub.title}" as ${input.status}`)
    );
  }

  // Title / assignee / expected date are manager-only.
  const wantsMeta =
    input.title !== undefined ||
    input.assigneeId !== undefined ||
    input.expectedDate !== undefined;
  if (wantsMeta) {
    if (!manager) {
      throw new AppError("Only the task owner can edit subtask details.", 403);
    }
    if (input.title !== undefined) sub.title = input.title.trim();
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
        const visible = await listVisibleUsers(actor);
        const u = visible.find((x) => x.id === input.assigneeId);
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
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) {
    throw new AppError("You are not allowed to act on this task.", 403);
  }

  const mine = task.assignees.find((a) => a.id === actor.id);
  const reviewer = canReview(actor, task);

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
    case "accept": {
      if (!mine || mine.status !== "assigned") {
        throw new AppError("You cannot accept this task right now.", 400);
      }
      mine.status = "accepted";
      mine.acceptedAt = now();
      task.activity.push(activity(actor, "accepted the task"));
      break;
    }
    case "start": {
      if (!mine || !["accepted", "in_progress"].includes(mine.status)) {
        throw new AppError("You cannot start this task right now.", 400);
      }
      mine.status = "in_progress";
      task.activity.push(activity(actor, "started work"));
      break;
    }
    case "progress": {
      if (!mine || !["accepted", "in_progress"].includes(mine.status)) {
        throw new AppError("You cannot update progress right now.", 400);
      }
      mine.status = "in_progress";
      mine.progress = input.progress ?? mine.progress;
      task.activity.push(activity(actor, `updated progress to ${mine.progress}%`));
      break;
    }
    case "submit": {
      if (!mine || !["accepted", "in_progress"].includes(mine.status)) {
        throw new AppError("You cannot submit this task right now.", 400);
      }
      mine.status = "submitted";
      mine.progress = 100;
      mine.submittedAt = now();
      if (input.note) pushComment(input.note, "note");
      task.activity.push(activity(actor, "submitted their work for review"));
      break;
    }
    case "approve": {
      if (!reviewer) throw new AppError("You cannot review this task.", 403);
      const target = task.assignees.find((a) => a.id === input.assigneeId);
      if (!target || target.status !== "submitted") {
        throw new AppError("That submission cannot be approved right now.", 400);
      }
      if (!input.evaluation) {
        throw new AppError("An evaluation is required to approve.", 400);
      }
      const { timeliness, quality, accuracy } = input.evaluation;
      target.evaluation = {
        timeliness,
        quality,
        accuracy,
        average: Math.round(((timeliness + quality + accuracy) / 3) * 10) / 10,
        ratedById: actor.id,
        ratedByName: actor.name,
        ratedAt: now(),
      };
      target.status = "completed";
      target.completedAt = now();
      if (input.note) pushComment(`To ${target.name}: ${input.note}`, "feedback");
      task.activity.push(
        activity(
          actor,
          `approved ${target.name}'s work (avg ${target.evaluation.average}/5)`
        )
      );
      break;
    }
    case "reject": {
      if (!reviewer) throw new AppError("You cannot review this task.", 403);
      const target = task.assignees.find((a) => a.id === input.assigneeId);
      if (!target || target.status !== "submitted") {
        throw new AppError("That submission cannot be returned right now.", 400);
      }
      if (!input.feedback) {
        throw new AppError("Please add feedback explaining what to change.", 400);
      }
      target.status = "in_progress";
      pushComment(`To ${target.name}: ${input.feedback}`, "feedback");
      task.activity.push(activity(actor, `requested changes from ${target.name}`));
      break;
    }
    default:
      throw new AppError("Unknown action.", 400);
  }

  task.updatedAt = now();
  await saveTask(task);

  // Notifications (best-effort).
  try {
    if (input.action === "submit") {
      const creator = await store.findById(task.assignerId);
      if (creator && creator.id !== actor.id) {
        await emailTaskSubmitted({
          to: creator.email,
          creatorName: creator.name,
          taskTitle: task.title,
          byName: actor.name,
          taskId: task.id,
        });
      }
    } else if (input.action === "approve" && input.assigneeId) {
      const target = await store.findById(input.assigneeId);
      if (target && target.id !== actor.id) {
        await emailTaskApproved({
          to: target.email,
          assigneeName: target.name,
          taskTitle: task.title,
          byName: actor.name,
          taskId: task.id,
        });
      }
    }
  } catch (err) {
    console.error("Task notification failed:", err);
  }

  return toDTO(task);
}
