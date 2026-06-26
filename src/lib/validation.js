import { z } from "zod";
import { ROLES } from "@/lib/rbac";
import { TASK_PRIORITIES } from "@/lib/task-meta";

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

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  // Empty = a draft task (not assigned to anyone yet).
  assigneeIds: z.array(z.string().min(1)).max(25).optional().default([]),
  priority: priorityEnum.default("medium"),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
  assigneeIds: z.array(z.string().min(1)).max(25).optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export const transitionSchema = z.object({
  action: z.enum(["start", "complete", "cancel", "reopen"]),
  note: optionalText(1000),
});

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

export const commentSchema = z.object({
  text: z.string().max(10000).optional().or(z.literal("")),
  parentId: z.string().optional().or(z.literal("")),
  attachments: z.array(attachmentSchema).max(10).optional(),
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
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});

 






// ── Meetings ───────────────────────────────────────────────────────
export const createMeetingSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  scheduledAt: z.string().trim().optional().or(z.literal("")),
  attendeeIds: z.array(z.string().min(1)).max(100).optional(),
  maxAttendees: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
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

 



