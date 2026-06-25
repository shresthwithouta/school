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
import { RichTextEditor } from "@/components/rich-text";
import { UserCombobox, type AssignableUser } from "@/components/tasks/user-combobox";
import { createTaskSchema } from "@/lib/validation";
import { TASK_PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import type { TaskDTO } from "@/lib/tasks";

export type { AssignableUser };

const fieldsSchema = createTaskSchema.omit({ assigneeIds: true });
type FieldValues = {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
};

export function TaskDialog({
  mode,
  task,
  assignees,
  currentUserId,
  trigger,
}: {
  mode: "create" | "edit";
  task?: TaskDTO;
  assignees: AssignableUser[];
  currentUserId: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    task ? task.assignees.map((a) => a.id) : [currentUserId]
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(fieldsSchema) as any,
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      priority: task?.priority ?? "medium",
      dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
    },
  });

  const priority = useWatch({ control, name: "priority" });
  const description = useWatch({ control, name: "description" });

  async function onSubmit(values: FieldValues) {
    if (selected.length === 0) {
      toast.error("Choose at least one person to assign.");
      return;
    }
    const url = mode === "create" ? "/api/tasks" : `/api/tasks/${task!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, assigneeIds: selected }),
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
                <Input id="dueDate" type="date" {...register("dueDate")} />
              </div>
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
