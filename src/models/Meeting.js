import { Schema, model, models } from "mongoose";

const Mixed = Schema.Types.Mixed;

const MeetingSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    key: { type: String, default: "" },
    seq: { type: Number, default: 0 },
    // Monotonic version for optimistic concurrency (see save() in lib/meetings).
    rev: { type: Number, default: 0 },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    // Optional external video-call link (Zoom / Google Meet / Teams URL).
    link: { type: String, default: "" },
    scheduledAt: { type: String, default: null },
    // Final discussion bullet points: { id, text, done, created*, done* }
    decisions: { type: [Mixed], default: [] },
    createdById: { type: String, required: true },
    createdByName: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    // { id, name, role, status: "invited"|"joined", joinedAt }
    attendees: { type: [Mixed], default: [] },
    // { id, authorId, authorName, text, attachments[], createdAt }
    messages: { type: [Mixed], default: [] },
    status: { type: String, default: "scheduled" }, // scheduled | completed
    summary: { type: String, default: "" },
    maxAttendees: { type: Number, default: null },
    // Set once the "starting soon" reminder has fired (see sendMeetingReminders);
    // cleared when the schedule moves so a new time can trigger a fresh one.
    reminderSent: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "meetings", versionKey: false, minimize: false }
);

// Indexes backing the scoped visibility query in lib/meetings
// (listVisibleMeetings) and the public-key lookup in rawById.
MeetingSchema.index({ createdById: 1 });
MeetingSchema.index({ "attendees.id": 1 });
MeetingSchema.index({ key: 1 });

const Meeting = models.Meeting || model("Meeting", MeetingSchema);
export default Meeting;
