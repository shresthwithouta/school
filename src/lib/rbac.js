/**
 * Role-Based Access Control.
 *
 * Two independent concepts live here:
 *
 * 1. Visibility TIERS — who can SEE and MANAGE whom (the /users area, team
 *    stats, task visibility). Three tiers:
 *      OWNER  — sees everyone, manages everyone        (top of the hierarchy)
 *      ADMIN  — sees other Admins + Workers            (cannot see Owners)
 *      WORKER — sees only their own scope              (bottom of the hierarchy)
 *
 * 2. Task-assignment RANK — who may ASSIGN a task to whom. This is a finer
 *    grain than tiers: a Teacher (a Worker) can still hand work to other
 *    Teachers/Accountants even though they can't see them in user management.
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
export const ROLES = [
  "Chairman/Director",
  "Principal",
  "Manager",
  "Coordinators",
  "Teacher",
  "Accountant",
  "Other Staff",
];

/** Maps every role to its visibility tier. */
export const ROLE_TIERS = {
  "Chairman/Director": TIERS.OWNER,
  Principal: TIERS.ADMIN,
  Manager: TIERS.ADMIN,
  Coordinators: TIERS.WORKER,
  Teacher: TIERS.WORKER,
  Accountant: TIERS.WORKER,
  "Other Staff": TIERS.WORKER,
};

/**
 * Task-assignment authority. Lower number = higher authority.
 * You can assign tasks to anyone whose rank is >= your own rank.
 *   1  Chairman/Director  → can assign to everyone
 *   2  Principal, Manager → everyone except Chairman/Director (and each other)
 *   3  Coordinators, Teacher, Accountant → each other + Other Staff
 *   4  Other Staff        → Other Staff only (lowest)
 */
export const ROLE_RANKS = {
  "Chairman/Director": 1,
  Principal: 2,
  Manager: 2,
  Coordinators: 3,
  Teacher: 3,
  Accountant: 3,
  "Other Staff": 4,
};

/** Unknown / legacy roles fall to the bottom rank. */
const LOWEST_RANK = 99;

/** Short human label + description for each role (used in the UI). */
export const ROLE_META = {
  "Chairman/Director": {
    tier: TIERS.OWNER,
    description: "Top authority. Full oversight; can assign work to anyone.",
  },
  Principal: {
    tier: TIERS.ADMIN,
    description:
      "Leads the school. Assigns work to anyone except the Chairman/Director.",
  },
  Manager: {
    tier: TIERS.ADMIN,
    description:
      "Runs operations. Assigns work to the Principal and everyone below.",
  },
  Coordinators: {
    tier: TIERS.WORKER,
    description: "Coordinates teachers, accountants and staff tasks.",
  },
  Teacher: {
    tier: TIERS.WORKER,
    description: "Executes assigned academic and class tasks.",
  },
  Accountant: {
    tier: TIERS.WORKER,
    description: "Handles budgets, procurement and finance tasks.",
  },
  "Other Staff": {
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

export const TIER_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  WORKER: "Worker",
};
