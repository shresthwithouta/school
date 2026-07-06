import { Schema, model, models } from "mongoose";

const Mixed = Schema.Types.Mixed;

// A recurring task is a *single* ongoing assignment (unlike the old flow, which
// cloned a whole Task each day). Its `schedule` decides which IST calendar days
// are "due"; on each due day every assignee uploads a result into `entries`.
// There is no complete/approve — it runs until the creator pauses or ends it.
const RecurringTaskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    // Human key, e.g. "RC-12".
    key: { type: String, default: "" },
    seq: { type: Number, default: 0 },
    // Monotonic version for optimistic concurrency (see saveRecurring).
    rev: { type: Number, default: 0 },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    priority: { type: String, required: true },
    // { freq: daily|weekdays|everyN|weekly, intervalDays?, weekday? }
    schedule: { type: Mixed, default: null },
    // First due day (ISO); optional last due day.
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    // Pause/resume (temporarily stop expecting entries) vs. active (ended).
    paused: { type: Boolean, default: false },
    pausedAt: { type: String, default: null },
    active: { type: Boolean, default: true },
    assignerId: { type: String, required: true },
    assignerName: { type: String, default: "" },
    assignerRole: { type: String, default: "" },
    // Each assignee: { id, name, role }
    assignees: { type: [Mixed], default: [] },
    // Each entry (one per assignee per due day):
    // { id, day:"YYYY-MM-DD", assigneeId, assigneeName, note, files:[...],
    //   createdAt, updatedAt }
    entries: { type: [Mixed], default: [] },
    activity: { type: [Mixed], default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "recurringtasks", versionKey: false, minimize: false }
);

// Backs the scoped visibility query in lib/recurring (listVisibleRecurring)
// and the daily reminder sweep.
RecurringTaskSchema.index({ assignerId: 1 });
RecurringTaskSchema.index({ "assignees.id": 1 });
RecurringTaskSchema.index({ key: 1 });
RecurringTaskSchema.index({ active: 1 });

const RecurringTask =
  models.RecurringTask || model("RecurringTask", RecurringTaskSchema);
export default RecurringTask;
