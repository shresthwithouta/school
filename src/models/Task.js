import { Schema, model, models } from "mongoose";

const Mixed = Schema.Types.Mixed;

const TaskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    priority: { type: String, required: true },
    dueDate: { type: String, default: null },
    assignerId: { type: String, required: true },
    assignerName: { type: String, default: "" },
    assignerRole: { type: String, default: "" },
    // Each assignee: { id, name, role, status, progress, evaluation, acceptedAt, submittedAt, completedAt }
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

const Task = models.Task || model("Task", TaskSchema);
export default Task;
