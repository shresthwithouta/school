import { z } from "zod";
import { ROLES } from "@/lib/rbac";
import { TASK_PRIORITIES } from "@/lib/task-meta";
import { SCHEDULE_FREQS } from "@/lib/recurring-schedule";

const roleEnum = z.enum(ROLES);
const optionalText = (max) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  role: roleEnum,
  department: optionalText(80),
  phone: optionalText(30),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80).optional(),
  role: roleEnum.optional(),
  department: optionalText(80),
  phone: optionalText(30),
  isActive: z.boolean().optional(),
  // Optional: a manager can set a new password for the member.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .optional()
    .or(z.literal("")),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  department: optionalText(80),
  phone: optionalText(30),
  bio: optionalText(280),
  // Only an inline image produced by the in-app uploader (a downscaled JPEG
  // data URL). Arbitrary http(s) URLs are rejected so a profile photo can't be
  // used to point every viewer's browser at a tracking pixel or internal host
  // (SSRF/stored-URL injection). Capped to keep the user document small.
  avatarUrl: z
    .string()
    .max(1_000_000, "Image is too large")
    .refine(
      (v) => v === "" || /^data:image\//.test(v),
      "Invalid image — upload a photo using the picker"
    )
    .optional()
    .or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(100),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

 




// ── Tasks ──────────────────────────────────────────────────────────
const priorityEnum = z.enum(TASK_PRIORITIES);

// Rich-text HTML field (sanitized server-side before storing).
const richText = z.string().max(20000).optional().or(z.literal(""));

export const attachmentSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.includes("res.cloudinary.com"), "Invalid upload URL"),
  publicId: z.string().min(1),
  resourceType: z.string().min(1),
  format: z.string().optional().or(z.literal("")),
  bytes: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  kind: z.enum(["image", "audio", "video", "file"]),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  // Empty = a draft task (not assigned to anyone yet). The cap is generous so a
  // bulk "assign all Teachers" (a whole role group) isn't rejected.
  assigneeIds: z.array(z.string().min(1)).max(200).optional().default([]),
  priority: priorityEnum.default("medium"),
  dueDate: z.string().trim().optional().or(z.literal("")),
  // Reference files/voice notes attached while writing the task.
  attachments: z.array(attachmentSchema).max(10).optional().default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
  assigneeIds: z.array(z.string().min(1)).max(200).optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export const transitionSchema = z.object({
  action: z.enum(["start", "submit", "approve", "sendback", "cancel", "reopen"]),
  // For approve / sendback: which assignee's submission is being reviewed. When
  // omitted the action targets the actor's own assignee record (start / submit).
  assigneeId: z.string().optional().or(z.literal("")),
  // Rich-text note: the submission write-up (submit), or review feedback /
  // cancel-reopen reason. Sanitized server-side before storing.
  note: richText,
  // Files attached to a "submit for review" (private submission deliverables).
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const commentSchema = z.object({
  text: z.string().max(10000).optional().or(z.literal("")),
  parentId: z.string().optional().or(z.literal("")),
  attachments: z.array(attachmentSchema).max(10).optional(),
  // User ids the comment @mentions. When the task creator mentions someone the
  // comment becomes private (see addComment in lib/tasks.js).
  mentions: z.array(z.string().min(1)).max(50).optional(),
});

 

// A subtask is a task with a parent — it carries the same core fields
// (title, rich description, priority) plus a single assignee and a date.
export const createSubtaskSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  assigneeId: z.string().optional().or(z.literal("")),
  priority: priorityEnum.default("medium"),
  expectedDate: z.string().trim().optional().or(z.literal("")),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
  assigneeId: z.string().optional(),
  priority: priorityEnum.optional(),
  expectedDate: z.string().optional(),
  status: z.enum(["todo", "in_progress", "submitted", "done"]).optional(),
});

 






// ── Recurring tasks ────────────────────────────────────────────────
// A recurring task is one ongoing assignment whose schedule decides which days
// are "due". `everyN` needs an interval; `weekly` needs a weekday.
const recurringSchedule = z
  .object({
    freq: z.enum(SCHEDULE_FREQS),
    intervalDays: z.coerce.number().int().min(1).max(90).optional(),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
  })
  .refine((s) => s.freq !== "everyN" || (s.intervalDays ?? 0) >= 1, {
    message: "Choose how many days between each occurrence.",
    path: ["intervalDays"],
  });

const optionalDate = z.string().trim().optional().or(z.literal(""));

export const createRecurringSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  assigneeIds: z.array(z.string().min(1)).min(1, "Assign at least one person").max(200),
  priority: priorityEnum.default("medium"),
  schedule: recurringSchedule,
  startDate: optionalDate,
  endDate: optionalDate,
  // Reference files/voice notes attached while setting up the recurring task.
  attachments: z.array(attachmentSchema).max(10).optional().default([]),
});

export const updateRecurringSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
  assigneeIds: z.array(z.string().min(1)).min(1).max(200).optional(),
  priority: priorityEnum.optional(),
  endDate: optionalDate,
  // Lifecycle toggles — at most one is acted on per request.
  action: z.enum(["pause", "resume", "end"]).optional(),
});

// One assignee's result for a given due day. The note is required so an entry
// always says *what* was done; files are optional supporting uploads.
export const recurringEntrySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid day")
    .optional()
    .or(z.literal("")),
  note: z.string().trim().min(3, "Add a short note about today's work").max(5000),
  files: z.array(attachmentSchema).max(10).optional(),
});

// ── Meetings ───────────────────────────────────────────────────────
// Optional external meeting link (Zoom/Meet/Teams). Only http(s) URLs are
// accepted so a stored link can't smuggle a javascript:/data: URL into the page.
const meetingLink = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Enter a valid http(s) link")
  .optional()
  .or(z.literal(""));

export const createMeetingSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  link: meetingLink,
  scheduledAt: z.string().trim().optional().or(z.literal("")),
  attendeeIds: z.array(z.string().min(1)).max(100).optional(),
  maxAttendees: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
  link: meetingLink,
  scheduledAt: z.string().trim().optional(),
  attendeeIds: z.array(z.string().min(1)).max(100).optional(),
  maxAttendees: z.coerce.number().int().min(0).max(1000).optional(),
});

export const meetingMessageSchema = z.object({
  text: z.string().max(10000).optional().or(z.literal("")),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const endMeetingSchema = z.object({
  summary: richText,
});

export const decisionSchema = z.object({
  // One or more points, one per line.
  text: z.string().trim().min(1, "Decision cannot be empty").max(2000),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export const decisionUpdateSchema = z.object({
  done: z.boolean(),
});

// ── File Repository (Chairman-managed) ─────────────────────────────
// Save an existing uploaded file into the repository. Carries the attachment
// fields plus optional provenance (which task/meeting it came from).
export const repoSaveSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.includes("res.cloudinary.com"), "Invalid file URL"),
  publicId: z.string().min(1),
  resourceType: z.string().min(1),
  format: z.string().optional().or(z.literal("")),
  bytes: z.coerce.number().int().min(0),
  name: z.string().min(1).max(255),
  kind: z.enum(["image", "audio", "video", "file"]),
  sourceType: z.enum(["task", "meeting", "upload"]).optional(),
  sourceId: z.string().max(200).optional().or(z.literal("")),
  sourceTitle: z.string().max(200).optional().or(z.literal("")),
});

// Replace a repository file's share list with these user ids.
export const repoShareSchema = z.object({
  userIds: z.array(z.string().min(1)).max(200),
});

// Permanently delete one or more repository files (and their Cloudinary assets).
export const repoDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

 



