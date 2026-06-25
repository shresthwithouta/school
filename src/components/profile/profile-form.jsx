"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateProfileSchema, } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "@/components/profile/avatar-upload";


export function ProfileForm({ user }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name,
      department: user.department,
      phone: user.phone,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    },
  });

  const avatarUrl = useWatch({ control, name: "avatarUrl" }) ?? "";
  const nameValue = useWatch({ control, name: "name" }) ?? user.name;

  async function onSubmit(values) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not update profile");
      return;
    }
    toast.success("Profile updated");
    reset(values);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label>Profile photo</Label>
        <AvatarUpload
          value={avatarUrl}
          name={nameValue}
          onChange={(v) =>
            setValue("avatarUrl", v, { shouldDirty: true, shouldValidate: true })
          }
        />
        {errors.avatarUrl && (
          <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            placeholder="e.g. Mathematics"
            {...register("department")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" placeholder="e.g. +91 98765 43210" {...register("phone")} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={3}
            placeholder="A short description about your role and responsibilities."
            {...register("bio")}
          />
          {errors.bio && (
            <p className="text-sm text-destructive">{errors.bio.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
