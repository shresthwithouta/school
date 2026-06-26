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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { RichTextEditor } from "@/components/rich-text";
import { UserCombobox, } from "@/components/tasks/user-combobox";
import { createMeetingSchema } from "@/lib/validation";


const fieldsSchema = createMeetingSchema.omit({ attendeeIds: true });







export function MeetingDialog({
  mode,
  meeting,
  people,
  currentUserId,
  trigger,
}





) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState(
    meeting ? meeting.attendees.map((a) => a.id) : []
  );

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
      title: meeting?.title ?? "",
      description: meeting?.description ?? "",
      scheduledAt: meeting?.scheduledAt ?? "",
      maxAttendees: meeting?.maxAttendees ?? 0,
    },
  });

  const description = useWatch({ control, name: "description" });
  const scheduledAt = useWatch({ control, name: "scheduledAt" });

  async function onSubmit(values) {
    const url = mode === "create" ? "/api/meetings" : `/api/meetings/${meeting.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, attendeeIds: attendees }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not save meeting");
      return;
    }
    toast.success(mode === "create" ? "Meeting scheduled" : "Meeting updated");
    setOpen(false);
    if (mode === "create") {
      reset();
      setAttendees([]);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 sm:p-6">
          <DialogTitle>
            {mode === "create" ? "Schedule meeting" : "Edit meeting"}
          </DialogTitle>
          <DialogDescription>
            Invite attendees and set an optional time and capacity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Agenda / description</Label>
              <RichTextEditor
                value={description ?? ""}
                onChange={(html) => setValue("description", html, { shouldDirty: true })}
                placeholder="What's this meeting about?"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Attendees{" "}
                <span className="text-muted-foreground">({attendees.length})</span>
              </Label>
              <UserCombobox
                users={people}
                value={attendees}
                onChange={setAttendees}
                currentUserId={currentUserId}
                placeholder="Search to invite…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">When</Label>
                <DateTimePicker
                  id="scheduledAt"
                  value={scheduledAt}
                  onChange={(v) =>
                    setValue("scheduledAt", v, { shouldDirty: true })
                  }
                  alwaysTime
                  placeholder="No time set"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Max attendees (0 = no limit)</Label>
                <Input
                  id="maxAttendees"
                  type="number"
                  min={0}
                  {...register("maxAttendees")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t p-4 sm:p-6">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Schedule" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
