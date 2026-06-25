import { Schema, model, models } from "mongoose";

const Mixed = Schema.Types.Mixed;

const MeetingSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    key: { type: String, default: "" },
    seq: { type: Number, default: 0 },
    title: { type: String, required: true },
    description: { type: String, default: "" },
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
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "meetings", versionKey: false, minimize: false }
);

const Meeting = models.Meeting || model("Meeting", MeetingSchema);
export default Meeting;
