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
import { Switch } from "@/components/ui/switch";
import { assignableRoles, ROLE_META } from "@/lib/rbac";
import { createUserSchema, updateUserSchema } from "@/lib/validation";
import type { UserDTO } from "@/lib/users";

type Mode = "create" | "edit";

type FormValues = {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
  phone: string;
  isActive: boolean;
};

export function UserDialog({
  mode,
  actorRole,
  user,
  trigger,
}: {
  mode: Mode;
  actorRole: string;
  user?: UserDTO;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const roles = assignableRoles(actorRole);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(
      mode === "create" ? createUserSchema : updateUserSchema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? roles[0] ?? "",
      department: user?.department ?? "",
      phone: user?.phone ?? "",
      isActive: user?.isActive ?? true,
    },
  });

  const role = useWatch({ control, name: "role" });
  const isActive = useWatch({ control, name: "isActive" });

  async function onSubmit(values: FormValues) {
    const url = mode === "create" ? "/api/users" : `/api/users/${user!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const payload =
      mode === "create"
        ? {
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role,
            department: values.department,
            phone: values.phone,
          }
        : {
            name: values.name,
            role: values.role,
            department: values.department,
            phone: values.phone,
            isActive: values.isActive,
          };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not save user");
      return;
    }

    toast.success(mode === "create" ? "Member added" : "Member updated");
    setOpen(false);
    if (mode === "create") reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add team member" : "Edit member"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create an account. The member signs in with the email and password you set."
              : "Update this member's details and access."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {mode === "create" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input
                  id="password"
                  type="text"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) =>
                setValue("role", v, { shouldValidate: true, shouldDirty: true })
              }
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role && ROLE_META[role as keyof typeof ROLE_META] && (
              <p className="text-xs text-muted-foreground">
                {ROLE_META[role as keyof typeof ROLE_META].description}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="e.g. Science"
                {...register("department")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
          </div>

          {mode === "edit" && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active account</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive members cannot sign in.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(v) =>
                  setValue("isActive", v, { shouldDirty: true })
                }
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Create account" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
