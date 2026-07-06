"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Paperclip, X } from "lucide-react";

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
import { AttachmentList, AttachmentUploader } from "@/components/attachments";
import { UserCombobox, } from "@/components/tasks/user-combobox";
import { createTaskSchema } from "@/lib/validation";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";


;

const fieldsSchema = createTaskSchema.omit({ assigneeIds: true });







export function TaskDialog({
  mode,
  task,
  assignees,
  currentUserId,
  trigger,
}





) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    task ? task.assignees.map((a) => a.id) : [currentUserId]
  );
  // Reference files/voice notes for the task itself (not a submission). In
  // "edit" mode the task already has an id, so each add/remove persists right
  // away via the task attachment endpoints. In "create" mode there's no task
  // yet, so uploads are staged locally and sent along with the create request.
  const [attachments, setAttachments] = useState(task?.attachments ?? []);

  async function addAttachment(a) {
    if (mode === "create") {
      setAttachments((p) => [...p, a]);
      return;
    }
    const res = await fetch(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not add attachment");
      return;
    }
    setAttachments(data.task.attachments);
    router.refresh();
  }

  async function removeAttachment(att, index) {
    if (mode === "create") {
      setAttachments((p) => p.filter((_, i) => i !== index));
      return;
    }
    const res = await fetch(`/api/tasks/${task.id}/attachments/${att.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not remove attachment");
      return;
    }
    setAttachments(data.task.attachments);
    router.refresh();
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(fieldsSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      priority: task?.priority ?? "medium",
      dueDate: task?.dueDate ?? "",
    },
  });

  const priority = useWatch({ control, name: "priority" });
  const description = useWatch({ control, name: "description" });
  const dueDate = useWatch({ control, name: "dueDate" });

  async function onSubmit(values) {
    if (selected.length === 0) {
      toast.error("Choose at least one person to assign.");
      return;
    }
    const url = mode === "create" ? "/api/tasks" : `/api/tasks/${task.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        assigneeIds: selected,
        ...(mode === "create" ? { attachments } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not save task");
      return;
    }
    toast.success(mode === "create" ? "Task created" : "Task updated");
    setOpen(false);
    if (mode === "create") {
      reset();
      setSelected([currentUserId]);
      setAttachments([]);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 sm:p-6">
          <DialogTitle>{mode === "create" ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Assign work to one or more people with a deadline and priority."
              : "Update this task's details."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
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
                placeholder="What needs to be done?"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Assign to{" "}
                <span className="text-muted-foreground">
                  ({selected.length} selected)
                </span>
              </Label>
              <UserCombobox
                users={assignees}
                value={selected}
                onChange={setSelected}
                currentUserId={currentUserId}
                placeholder="Type a name to add…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setValue("priority", v)}
                >
                  <SelectTrigger id="priority" className="w-full">
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
                <Label htmlFor="dueDate">Due date</Label>
                <DateTimePicker
                  id="dueDate"
                  value={dueDate}
                  onChange={(v) => setValue("dueDate", v, { shouldDirty: true })}
                  placeholder="No due date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Attachments{" "}
                <span className="text-muted-foreground">(files or a voice note)</span>
              </Label>
              {mode === "edit" ? (
                <AttachmentList
                  attachments={attachments}
                  onRemove={(attId) =>
                    removeAttachment(attachments.find((a) => a.id === attId))
                  }
                  canRemove={() => true}
                />
              ) : (
                attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachments.map((a, i) => (
                      <span
                        key={`${a.publicId}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2 py-1 text-xs"
                      >
                        <Paperclip className="size-3" />
                        <span className="max-w-40 truncate">{a.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a, i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )
              )}
              <AttachmentUploader onAdd={addAttachment} />
            </div>
          </div>

          <DialogFooter className="border-t p-4 sm:p-6">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Create task" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
