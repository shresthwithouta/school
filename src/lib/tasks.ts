import crypto from "crypto";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanHtml } from "@/lib/sanitize";
import { isOwner } from "@/lib/rbac";
import { listVisibleUsers } from "@/lib/users";
import Task from "@/models/Task";
import type { SessionUser } from "@/lib/session";
import type {
  CreateSubtaskInput,
  CreateTaskInput,
  TransitionInput,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "@/lib/validation";
import {
  type SubtaskStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/task-meta";

export type TaskComment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  kind: "comment" | "feedback" | "note";
  createdAt: string;
};

export type TaskActivity = {
  id: string;
  actorId: string;
  actorName: string;
  message: string;
  createdAt: string;
};

export type TaskEvaluation = {
  timeliness: number;
  quality: number;
  accuracy: number;
  average: number;
  ratedById: string;
  ratedByName: string;
  ratedAt: string;
};

export type Assignee = {
  id: string;
  name: string;
  role: string;
  status: TaskStatus;
  progress: number;
  evaluation: TaskEvaluation | null;
  acceptedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
};

export type Subtask = {
  id: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string;
  expectedDate: string | null;
  status: SubtaskStatus;
  createdAt: string;
  completedAt: string | null;
};

export type StoredTask = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  assignerId: string;
  assignerName: string;
  assignerRole: string;
  assignees: Assignee[];
  subtasks: Subtask[];
  comments: TaskComment[];
  activity: TaskActivity[];
  createdAt: string;
  updatedAt: string;
};

export type TaskDTO = StoredTask & {
  status: TaskStatus;
  progress: number;
  overdue: boolean;
};

// ── Persistence (MongoDB) ──────────────────────────────────────────
async function rawById(id: string): Promise<StoredTask | null> {
  await connectToDatabase();
  const doc = await Task.findOne({ id }).lean();
  if (!doc) return null;
  const task = stripMongo<StoredTask>(doc as Record<string, unknown>);
  if (!Array.isArray(task.assignees)) task.assignees = [];
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  return task;
}

async function saveTask(task: StoredTask): Promise<void> {
  await connectToDatabase();
  await Task.replaceOne({ id: task.id }, task, { upsert: true });
}

function now() {
  return new Date().toISOString();
}

function newAssignee(u: { id: string; name: string; role: string }): Assignee {
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
function deriveStatus(assignees: Assignee[]): TaskStatus {
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

function deriveProgress(assignees: Assignee[]): number {
  if (assignees.length === 0) return 0;
  const sum = assignees.reduce(
    (s, a) => s + (a.status === "completed" ? 100 : a.progress),
    0
  );
  return Math.round(sum / assignees.length);
}

function toDTO(t: StoredTask): TaskDTO {
  const status = deriveStatus(t.assignees);
  const overdue =
    !!t.dueDate &&
    status !== "completed" &&
    new Date(t.dueDate).getTime() < Date.now();
  return { ...t, status, progress: deriveProgress(t.assignees), overdue };
}

function activity(actor: SessionUser, message: string): TaskActivity {
  return {
    id: crypto.randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    message,
    createdAt: now(),
  };
}

// ── Visibility & permissions ───────────────────────────────────────
async function visibleUserIds(actor: SessionUser): Promise<Set<string>> {
  const users = await listVisibleUsers(actor);
  return new Set(users.map((u) => u.id));
}

function canSee(task: StoredTask, ids: Set<string>): boolean {
  return ids.has(task.assignerId) || task.assignees.some((a) => ids.has(a.id));
}

function canReview(actor: SessionUser, task: StoredTask): boolean {
  return actor.id === task.assignerId || isOwner(actor.role);
}

function canEdit(actor: SessionUser, task: StoredTask): boolean {
  return actor.id === task.assignerId || isOwner(actor.role);
}

// ── Queries ────────────────────────────────────────────────────────
export async function listVisibleTasks(actor: SessionUser): Promise<TaskDTO[]> {
  const ids = await visibleUserIds(actor);
  await connectToDatabase();
  const docs = await Task.find().lean();
  return docs
    .map((d) => {
      const t = stripMongo<StoredTask>(d as Record<string, unknown>);
      if (!Array.isArray(t.assignees)) t.assignees = [];
      if (!Array.isArray(t.subtasks)) t.subtasks = [];
      return t;
    })
    .filter((t) => canSee(t, ids))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(toDTO);
}

export async function getTaskForActor(
  actor: SessionUser,
  id: string
): Promise<TaskDTO | null> {
  const task = await rawById(id);
  if (!task) return null;
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) return null;
  return toDTO(task);
}

export type TaskStats = {
  total: number;
  pending: number;
  inProgress: number;
  inReview: number;
  completed: number;
  overdue: number;
  assignedToMe: number;
};

export async function getTaskStats(actor: SessionUser): Promise<TaskStats> {
  const tasks = await listVisibleTasks(actor);
  const stats: TaskStats = {
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

// ── Mutations ──────────────────────────────────────────────────────
export async function createTask(
  actor: SessionUser,
  input: CreateTaskInput
): Promise<TaskDTO> {
  const visible = await listVisibleUsers(actor);
  const allowed = new Map(visible.map((u) => [u.id, u]));
  const chosen = input.assigneeIds.filter((id) => allowed.has(id));
  if (chosen.length === 0) {
    throw new AppError("You can only assign people at or below your level.", 403);
  }

  const assignees = chosen.map((id) => {
    const u = allowed.get(id)!;
    return newAssignee({ id: u.id, name: u.name, role: u.role });
  });

  const ts = now();
  const names = assignees.map((a) => a.name).join(", ");
  const task: StoredTask = {
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
    activity: [activity(actor, `created this task and assigned it to ${names}`)],
    createdAt: ts,
    updatedAt: ts,
  };

  await saveTask(task);
  return toDTO(task);
}

export async function updateTask(
  actor: SessionUser,
  id: string,
  input: UpdateTaskInput
): Promise<TaskDTO> {
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
      const u = allowed.get(cid)!;
      return newAssignee({ id: u.id, name: u.name, role: u.role });
    });
    task.activity.push(activity(actor, "updated the assignees"));
  }

  task.updatedAt = now();
  await saveTask(task);
  return toDTO(task);
}

export async function deleteTask(
  actor: SessionUser,
  id: string
): Promise<void> {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canEdit(actor, task)) {
    throw new AppError("You are not allowed to delete this task.", 403);
  }
  await Task.deleteOne({ id });
}

export async function addComment(
  actor: SessionUser,
  id: string,
  text: string
): Promise<TaskDTO> {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) {
    throw new AppError("You are not allowed to comment on this task.", 403);
  }

  const clean = cleanHtml(text);
  if (!clean) throw new AppError("Comment cannot be empty.", 400);

  task.comments.push({
    id: crypto.randomUUID(),
    authorId: actor.id,
    authorName: actor.name,
    text: clean,
    kind: "comment",
    createdAt: now(),
  });
  task.updatedAt = now();
  await saveTask(task);
  return toDTO(task);
}

// ── Subtasks (one level deep) ──────────────────────────────────────
export async function addSubtask(
  actor: SessionUser,
  taskId: string,
  input: CreateSubtaskInput
): Promise<TaskDTO> {
  const task = await rawById(taskId);
  if (!task) throw new AppError("Task not found.", 404);
  if (!canEdit(actor, task)) {
    throw new AppError("Only the task owner can add subtasks.", 403);
  }

  let assigneeId: string | null = null;
  let assigneeName = "";
  if (input.assigneeId) {
    const visible = await listVisibleUsers(actor);
    const u = visible.find((x) => x.id === input.assigneeId);
    if (!u) throw new AppError("You cannot assign to that person.", 403);
    assigneeId = u.id;
    assigneeName = u.name;
  }

  const sub: Subtask = {
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
  actor: SessionUser,
  taskId: string,
  subId: string,
  input: UpdateSubtaskInput
): Promise<TaskDTO> {
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
  actor: SessionUser,
  taskId: string,
  subId: string
): Promise<TaskDTO> {
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
  actor: SessionUser,
  id: string,
  input: TransitionInput
): Promise<TaskDTO> {
  const task = await rawById(id);
  if (!task) throw new AppError("Task not found.", 404);
  const ids = await visibleUserIds(actor);
  if (!canSee(task, ids)) {
    throw new AppError("You are not allowed to act on this task.", 403);
  }

  const mine = task.assignees.find((a) => a.id === actor.id);
  const reviewer = canReview(actor, task);

  const pushComment = (text: string, kind: TaskComment["kind"]) => {
    task.comments.push({
      id: crypto.randomUUID(),
      authorId: actor.id,
      authorName: actor.name,
      text: cleanHtml(text),
      kind,
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
  return toDTO(task);
}
