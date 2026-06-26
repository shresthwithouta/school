import bcrypt from "bcryptjs";

import { AppError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/db";
import { store, } from "@/lib/store";
import Task from "@/models/Task";
import Meeting from "@/models/Meeting";
import {
  ROLE_TIERS,
  TIERS,
  assignableRoles,
  canAssignTaskTo,
  canManage,
  canManageTarget,
  getTier,
  isOwner,
  visibleTiers,


} from "@/lib/rbac";







 














function toDTO(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tier: getTier(u.role),
    department: u.department ?? "",
    phone: u.phone ?? "",
    avatarUrl: u.avatarUrl ?? "",
    bio: u.bio ?? "",
    isActive: u.isActive ?? true,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt ?? "",
  };
}

/** Roles that fall within a set of tiers. */
function rolesInTiers(tiers) {
  return (Object.keys(ROLE_TIERS) ).filter((r) =>
    tiers.includes(ROLE_TIERS[r])
  );
}

/** How many active Owner-tier accounts currently exist. */
async function activeOwnerCount() {
  const all = await store.list();
  return all.filter((u) => (u.isActive ?? true) && isOwner(u.role)).length;
}

/**
 * Users the actor is allowed to see:
 *   Owner  -> everyone
 *   Admin  -> Admins + Workers (not Owners)
 *   Worker -> only themselves
 */
export async function listVisibleUsers(actor) {
  const tiers = visibleTiers(actor.role);

  if (tiers.length === 0) {
    const me = await store.findById(actor.id);
    return me ? [toDTO(me)] : [];
  }

  const roles = new Set(rolesInTiers(tiers));
  const all = await store.list();
  return all
    .filter((u) => roles.has(u.role))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(toDTO);
}

/**
 * People the actor may ASSIGN TASKS to — driven by role rank, not visibility
 * tiers. A Teacher can assign to other Teachers/Accountants even though user
 * management hides them. Always includes the actor (self-assignment).
 * Inactive accounts are excluded — you can't hand work to a disabled user.
 */
export async function listAssignableTaskUsers(actor) {
  const all = await store.list();
  return all
    .filter((u) => u.isActive ?? true)
    .filter((u) => u.id === actor.id || canAssignTaskTo(actor.role, u.role))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map(toDTO);
}

export async function getUserByIdForActor(
  actor,
  id
) {
  const u = await store.findById(id);
  if (!u) return null;

  // Workers can only view themselves.
  if (!canManage(actor.role) && u.id !== actor.id) return null;
  // Admins cannot view Owners.
  if (getTier(actor.role) === TIERS.ADMIN && getTier(u.role) === TIERS.OWNER) {
    return null;
  }
  return toDTO(u);
}

 






export async function getTeamStats(actor) {
  const users = await listVisibleUsers(actor);
  const byTier = {
    [TIERS.OWNER]: 0,
    [TIERS.ADMIN]: 0,
    [TIERS.WORKER]: 0,
  };
  let active = 0;
  for (const u of users) {
    byTier[u.tier] += 1;
    if (u.isActive) active += 1;
  }
  return {
    total: users.length,
    active,
    inactive: users.length - active,
    byTier,
  };
}

export async function createUser(
  actor,
  input
) {
  if (!canManage(actor.role)) {
    throw new AppError("You are not allowed to create users.", 403);
  }
  if (!assignableRoles(actor.role).includes(input.role )) {
    throw new AppError("You cannot assign that role.", 403);
  }

  const email = input.email.toLowerCase().trim();
  if (await store.findByEmail(email)) {
    throw new AppError("A user with that email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const created = await store.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role: input.role,
    department: input.department ?? "",
    phone: input.phone ?? "",
    avatarUrl: "",
    bio: "",
    isActive: true,
    mustChangePassword: true,
    createdBy: actor.id,
  });

  return toDTO(created);
}

export async function updateUser(
  actor,
  id,
  input
) {
  const u = await store.findById(id);
  if (!u) throw new AppError("User not found.", 404);

  if (!canManageTarget(actor.role, u.role)) {
    throw new AppError("You are not allowed to manage this user.", 403);
  }

  if (input.role && input.role !== u.role) {
    if (!assignableRoles(actor.role).includes(input.role )) {
      throw new AppError("You cannot assign that role.", 403);
    }
  }

  // An Owner must not strip their own access by mistake.
  if (u.id === actor.id && input.role && !isOwner(input.role) && isOwner(actor.role)) {
    throw new AppError("You cannot change your own Owner role.", 400);
  }

  // Never let the organisation lose its last active Owner. Another Owner could
  // otherwise demote or deactivate the only remaining Owner, locking everyone
  // out of Owner-tier management for good.
  if (isOwner(u.role) && (u.isActive ?? true)) {
    const losingOwner =
      (input.role && !isOwner(input.role)) || input.isActive === false;
    if (losingOwner && (await activeOwnerCount()) <= 1) {
      throw new AppError(
        "This is the last active Owner — promote another Owner before changing this account.",
        400
      );
    }
  }

  const patch = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.role !== undefined) patch.role = input.role;
  if (input.department !== undefined) patch.department = input.department;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.isActive !== undefined) {
    if (u.id === actor.id && input.isActive === false) {
      throw new AppError("You cannot deactivate your own account.", 400);
    }
    patch.isActive = input.isActive;
  }
  if (input.password) {
    patch.passwordHash = await bcrypt.hash(input.password, 10);
    patch.mustChangePassword = true;
  }

  const updated = await store.update(id, patch);
  if (!updated) throw new AppError("User not found.", 404);
  return toDTO(updated);
}

export async function deleteUser(
  actor,
  id
) {
  if (id === actor.id) {
    throw new AppError("You cannot delete your own account.", 400);
  }

  const u = await store.findById(id);
  if (!u) throw new AppError("User not found.", 404);

  if (!canManageTarget(actor.role, u.role)) {
    throw new AppError("You are not allowed to delete this user.", 403);
  }

  // Don't let the only remaining Owner be deleted (org lockout).
  if (isOwner(u.role) && (u.isActive ?? true) && (await activeOwnerCount()) <= 1) {
    throw new AppError("This is the last active Owner and cannot be deleted.", 400);
  }

  // Tasks and meetings store denormalized copies of the user, so a hard delete
  // would orphan them (a task assigned only to a deleted user can never be
  // completed, and their analytics linger forever). If the account is
  // referenced anywhere, refuse and steer the admin to deactivation instead —
  // a deactivated user keeps their history but can't log in or be assigned new
  // work.
  await connectToDatabase();
  const [taskRefs, meetingRefs] = await Promise.all([
    Task.countDocuments({
      $or: [{ assignerId: id }, { "assignees.id": id }],
    }),
    Meeting.countDocuments({
      $or: [{ createdById: id }, { "attendees.id": id }],
    }),
  ]);
  if (taskRefs > 0 || meetingRefs > 0) {
    throw new AppError(
      "This person is still referenced by tasks or meetings. Deactivate the account instead of deleting it to preserve that history.",
      409
    );
  }

  await store.remove(id);
}

export async function updateOwnProfile(
  userId,
  input
) {
  const u = await store.findById(userId);
  if (!u) throw new AppError("User not found.", 404);

  const updated = await store.update(userId, {
    name: input.name.trim(),
    department: input.department ?? "",
    phone: input.phone ?? "",
    bio: input.bio ?? "",
    avatarUrl: input.avatarUrl ?? "",
  });
  if (!updated) throw new AppError("User not found.", 404);
  return toDTO(updated);
}

export async function changeOwnPassword(
  userId,
  currentPassword,
  newPassword
) {
  const u = await store.findByIdWithPassword(userId);
  if (!u) throw new AppError("User not found.", 404);

  const valid = await bcrypt.compare(currentPassword, u.passwordHash);
  if (!valid) throw new AppError("Your current password is incorrect.", 400);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await store.update(userId, { passwordHash, mustChangePassword: false });
}
