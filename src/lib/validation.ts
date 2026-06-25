import { z } from "zod";
import { ROLES } from "@/lib/rbac";
import { TASK_PRIORITIES } from "@/lib/task-meta";

const roleEnum = z.enum(ROLES);
const optionalText = (max: number) =>
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
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  department: optionalText(80),
  phone: optionalText(30),
  bio: optionalText(280),
  // Uploaded image (data URL) or an http(s) URL. Capped to keep documents small.
  avatarUrl: z
    .string()
    .max(3_000_000, "Image is too large")
    .refine(
      (v) => v === "" || /^(data:image\/|https?:\/\/)/.test(v),
      "Invalid image"
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

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Tasks ──────────────────────────────────────────────────────────
const priorityEnum = z.enum(TASK_PRIORITIES);

// Rich-text HTML field (sanitized server-side before storing).
const richText = z.string().max(20000).optional().or(z.literal(""));

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  description: richText,
  assigneeIds: z
    .array(z.string().min(1))
    .min(1, "Choose at least one person")
    .max(25),
  priority: priorityEnum.default("medium"),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: richText,
  assigneeIds: z.array(z.string().min(1)).min(1).max(25).optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

const ratingSchema = z.coerce.number().int().min(1).max(5);

export const transitionSchema = z.object({
  action: z.enum(["accept", "start", "progress", "submit", "approve", "reject"]),
  /** Target assignee for review actions (approve/reject). */
  assigneeId: z.string().min(1).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  note: optionalText(1000),
  feedback: optionalText(1000),
  evaluation: z
    .object({
      timeliness: ratingSchema,
      quality: ratingSchema,
      accuracy: ratingSchema,
    })
    .optional(),
});

export const commentSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty").max(10000),
  parentId: z.string().optional().or(z.literal("")),
});

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(2, "Title is too short").max(140),
  assigneeId: z.string().optional().or(z.literal("")),
  expectedDate: z.string().trim().optional().or(z.literal("")),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  assigneeId: z.string().optional(),
  expectedDate: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;
