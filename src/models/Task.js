import { Schema, model, models } from "mongoose";

const Mixed = Schema.Types.Mixed;

const TaskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    // Jira-style human key, e.g. "AC-12" (prefix from title + sequence number).
    key: { type: String, default: "" },
    seq: { type: Number, default: 0 },
    // Monotonic version for optimistic concurrency (see saveTask in lib/tasks).
    rev: { type: Number, default: 0 },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    priority: { type: String, required: true },
    dueDate: { type: String, default: null },
    // A task with no assignees is a draft. Cancel/reopen toggle `cancelled`.
    cancelled: { type: Boolean, default: false },
    cancelledAt: { type: String, default: null },
    // Per-task counter for subtask keys (SB-1, SB-2, …).
    subSeq: { type: Number, default: 0 },
    assignerId: { type: String, required: true },
    assignerName: { type: String, default: "" },
    assignerRole: { type: String, default: "" },
    // Each assignee: { id, name, role, status, completedAt }
    assignees: { type: [Mixed], default: [] },
    // Each subtask: { id, title, assigneeId, assigneeName, expectedDate, status, createdAt, completedAt }
    subtasks: { type: [Mixed], default: [] },
    comments: { type: [Mixed], default: [] },
    attachments: { type: [Mixed], default: [] },
    activity: { type: [Mixed], default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "tasks", versionKey: false, minimize: false }
);

// Indexes backing the scoped visibility query in lib/tasks (listVisibleTasks)
// and the public-key lookup in rawById.
TaskSchema.index({ assignerId: 1 });
TaskSchema.index({ "assignees.id": 1 });
TaskSchema.index({ "subtasks.assigneeId": 1 });
TaskSchema.index({ key: 1 });

const Task = models.Task || model("Task", TaskSchema);
export default Task;
