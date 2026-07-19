/**
 * Role-Based Access Control.
 *
 * Four roles, top of list = highest authority: Admin, Manager, Teacher, Staff.
 * Teacher and Staff sit at the same rank — neither manages the other.
 *
 * Two independent concepts live here:
 *
 * 1. Visibility TIERS — who can SEE and MANAGE whom (the /users area, team
 *    stats, task visibility). Three tiers, one role per tier except the
 *    bottom one (NOTE: the tier key "ADMIN" is an internal holdover name —
 *    it now corresponds to the "Manager" role, not the "Admin" role; "Admin"
 *    the role is tier OWNER):
 *      OWNER  — role "Admin"            — sees everyone, manages everyone
 *      ADMIN  — role "Manager"          — sees Managers + Teachers/Staff (not Admins)
 *      WORKER — roles "Teacher"/"Staff" — sees only their own scope
 *
 * 2. Task-assignment RANK — who may ASSIGN a task to whom. This is a finer
 *    grain than tiers: a Teacher (a Worker) can still hand work to other
 *    Teachers/Staff even though they can't see them in user management.
 *    Rule: you may assign to anyone at your own rank or below (rank 1 is the
 *    highest authority). See ROLE_RANKS / canAssignTaskTo below.
 *
 * To re-map a role, change ROLE_TIERS and ROLE_RANKS below.
 */

export const TIERS = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  WORKER: "WORKER",
};

/** Canonical role values (stored in the DB). Top of list = highest authority. */
export const ROLES = ["Admin", "Manager", "Teacher", "Staff"];

/** Maps every role to its visibility tier. */
export const ROLE_TIERS = {
  Admin: TIERS.OWNER,
  Manager: TIERS.ADMIN,
  Teacher: TIERS.WORKER,
  Staff: TIERS.WORKER,
};

/**
 * Task-assignment authority. Lower number = higher authority.
 * You can assign tasks to anyone whose rank is >= your own rank.
 *   1  Admin            → can assign to everyone
 *   2  Manager          → everyone except Admin
 *   3  Teacher, Staff    → each other only (same rank)
 */
export const ROLE_RANKS = {
  Admin: 1,
  Manager: 2,
  Teacher: 3,
  Staff: 3,
};

/** Unknown / legacy roles fall to the bottom rank. */
const LOWEST_RANK = 99;

/** Short human label + description for each role (used in the UI). */
export const ROLE_META = {
  Admin: {
    tier: TIERS.OWNER,
    description: "Top authority. Full oversight; can assign work to anyone and appoint Managers.",
  },
  Manager: {
    tier: TIERS.ADMIN,
    description: "Runs day-to-day operations. Assigns work to Teachers and Staff.",
  },
  Teacher: {
    tier: TIERS.WORKER,
    description: "Executes assigned academic and class tasks.",
  },
  Staff: {
    tier: TIERS.WORKER,
    description: "Support staff who carry out assigned tasks.",
  },
};

export function getTier(role) {
  if (role && role in ROLE_TIERS) return ROLE_TIERS[role];
  return TIERS.WORKER;
}

/** Task-assignment rank for a role (lower = more authority). */
export function getRank(role) {
  if (role && role in ROLE_RANKS) return ROLE_RANKS[role];
  return LOWEST_RANK;
}

export function isOwner(role) {
  return getTier(role) === TIERS.OWNER;
}

export function isAdmin(role) {
  return getTier(role) === TIERS.ADMIN;
}

export function isWorker(role) {
  return getTier(role) === TIERS.WORKER;
}

/** Owner + Admin tiers can reach management areas (users, reports, etc.). */
export function canManage(role) {
  const t = getTier(role);
  return t === TIERS.OWNER || t === TIERS.ADMIN;
}

/**
 * Whether `actorRole` may assign a task to someone with `targetRole`.
 * You can assign to your own rank or anyone below you. Pure (client-safe);
 * also re-enforced server-side in lib/tasks.
 */
export function canAssignTaskTo(actorRole, targetRole) {
  return getRank(targetRole) >= getRank(actorRole);
}

/** Roles an actor is allowed to assign tasks to. */
export function assignableTaskRoles(actorRole) {
  return ROLES.filter((r) => canAssignTaskTo(actorRole, r));
}

/**
 * Which tiers a given actor is allowed to *see* (and list).
 *   Owner  -> [Owner, Admin, Worker]
 *   Admin  -> [Admin, Worker]
 *   Worker -> []  (only themselves, handled separately)
 */
export function visibleTiers(role) {
  const t = getTier(role);
  if (t === TIERS.OWNER) return [TIERS.OWNER, TIERS.ADMIN, TIERS.WORKER];
  if (t === TIERS.ADMIN) return [TIERS.ADMIN, TIERS.WORKER];
  return [];
}

/** Roles an actor is allowed to *assign* when creating a new user. */
export function assignableRoles(role) {
  const t = getTier(role);
  if (t === TIERS.OWNER) return [...ROLES];
  if (t === TIERS.ADMIN) return ROLES.filter((r) => ROLE_TIERS[r] === TIERS.WORKER);
  return [];
}

/** Can `actor` create users at all? Owner: anyone. Admin: workers only. */
export function canCreateUsers(role) {
  return canManage(role);
}

/**
 * Whether an actor may edit / deactivate / delete a user with `targetRole`.
 *   Owner -> anyone
 *   Admin -> Workers only (not other Admins, not Owners)
 *   Worker -> no one
 * Pure function (client-safe) — also enforced server-side in lib/users.
 */
export function canManageTarget(actorRole, targetRole) {
  const a = getTier(actorRole);
  const t = getTier(targetRole);
  if (a === TIERS.OWNER) return true;
  if (a === TIERS.ADMIN) return t === TIERS.WORKER;
  return false;
}

