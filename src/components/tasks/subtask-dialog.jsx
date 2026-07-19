"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { RichTextEditor } from "@/components/rich-text";
import { UserCombobox } from "@/components/tasks/user-combobox";
import { createSubtaskSchema } from "@/lib/validation";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";

// Assignee is handled with its own state (single-select), so omit it here.
const fieldsSchema = createSubtaskSchema.omit({ assigneeId: true });

// Edit a subtask in a modal — the same affordance tasks get via TaskDialog, so
// you can tweak a subtask without leaving the task page. Mirrors the subtask
// create form's fields and posts to the subtask PATCH endpoint.
export function SubtaskDialog({
  task,
  sub,
  assignees,
  currentUserId,
  canEditDate = true,
  trigger,
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Single assignee, held as a 0-or-1 array so we can reuse UserCombobox.
  const [assignee, setAssignee] = useState(sub.assigneeId ? [sub.assigneeId] : []);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(fieldsSchema),
    defaultValues: {
      title: sub.title ?? "",
      description: sub.description ?? "",
      priority: sub.priority ?? "medium",
      expectedDate: sub.expectedDate ?? "",
    },
  });

  const priority = useWatch({ control, name: "priority" });
  const description = useWatch({ control, name: "description" });
  const expectedDate = useWatch({ control, name: "expectedDate" });

  async function onSubmit(values) {
    // Only whoever raised the subtask, the task creator, or a manager can move
    // its due date — drop the field entirely for anyone else rather than let
    // the server reject the whole save.
    const { expectedDate, ...rest } = values;
    const payload = canEditDate ? values : rest;
    const res = await fetch(`/api/tasks/${task.id}/subtasks/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, assigneeId: assignee[0] ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not save subtask");
      return;
    }
    toast.success("Subtask updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 sm:p-6">
          <DialogTitle>Edit subtask</DialogTitle>
          <DialogDescription>Update this subtask&apos;s details.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="sub-title">Title</Label>
              <Input
                id="sub-title"
                {...register("title")}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                value={description ?? ""}
                onChange={(html) =>
                  setValue("description", html, { shouldDirty: true })
                }
                placeholder="Add details, context or steps…"
              />
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <UserCombobox
                users={assignees}
                value={assignee}
                onChange={setAssignee}
                currentUserId={currentUserId}
                placeholder="Search a name…"
                single
              />
              {assignee.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Unassigned — search to assign someone.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sub-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setValue("priority", v)}
                >
                  <SelectTrigger id="sub-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-expected">Expected date</Label>
                <DateTimePicker
                  id="sub-expected"
                  value={expectedDate}
                  onChange={(v) =>
                    setValue("expectedDate", v, { shouldDirty: true })
                  }
                  placeholder="No date set"
                  disabled={!canEditDate}
                />
                {!canEditDate && (
                  <p className="text-xs text-muted-foreground">
                    Only the subtask&apos;s creator or a manager can change this.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t p-4 sm:p-6">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
