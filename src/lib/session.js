import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { canManage, getTier, isOwner, } from "@/lib/rbac";

 








/** Returns the current user (or null), shaped for the UI. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    tier: session.user.tier ?? getTier(session.user.role),
    image: session.user.image ?? null,
  };
}

/** Server-component guard: redirect to /login if not authenticated. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Server-component guard: only Owner + Admin tiers may pass. */
export async function requireManager() {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/dashboard");
  return user;
}

/** Server-component guard: only the Owner tier may pass. */
export async function requireOwner() {
  const user = await requireUser();
  if (!isOwner(user.role)) redirect("/dashboard");
  return user;
}
