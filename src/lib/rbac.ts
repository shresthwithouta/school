/**
 * Role-Based Access Control.
 *
 * Roles keep the exact titles from the requirements document. Each role belongs
 * to one of three visibility TIERS that drive who can see and manage whom:
 *
 *   OWNER  — sees everyone, manages everyone        (top of the hierarchy)
 *   ADMIN  — sees other Admins + Workers            (cannot see Owners)
 *   WORKER — sees only their own scope              (bottom of the hierarchy)
 *
 * To re-map a role to a different tier, just change ROLE_TIERS below.
 */

export const TIERS = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  WORKER: "WORKER",
} as const;

export type Tier = (typeof TIERS)[keyof typeof TIERS];

/** Canonical role values (stored in the DB). Titles taken from the PDF. */
export const ROLES = [
  "Chairman/Director",
  "Principal",
  "Academic Coordinator",
  "Administrative Manager",
  "Event Coordinator",
  "Accountant",
  "Teacher",
  "Class Teacher",
  "Team Member",
] as const;

export type Role = (typeof ROLES)[number];

/** Maps every role to its visibility tier. */
export const ROLE_TIERS: Record<Role, Tier> = {
  "Chairman/Director": TIERS.OWNER,
  Principal: TIERS.ADMIN,
  "Academic Coordinator": TIERS.ADMIN,
  "Administrative Manager": TIERS.ADMIN,
  "Event Coordinator": TIERS.ADMIN,
  Accountant: TIERS.WORKER,
  Teacher: TIERS.WORKER,
  "Class Teacher": TIERS.WORKER,
  "Team Member": TIERS.WORKER,
};

/** Short human label + description for each role (used in the UI). */
export const ROLE_META: Record<Role, { tier: Tier; description: string }> = {
  "Chairman/Director": {
    tier: TIERS.OWNER,
    description: "Full oversight of every person, task and report.",
  },
  Principal: {
    tier: TIERS.ADMIN,
    description: "Leads academics & operations; assigns event coordinators.",
  },
  "Academic Coordinator": {
    tier: TIERS.ADMIN,
    description: "Coordinates teachers and academic tasks.",
  },
  "Administrative Manager": {
    tier: TIERS.ADMIN,
    description: "Manages administrative operations and staff.",
  },
  "Event Coordinator": {
    tier: TIERS.ADMIN,
    description: "Builds event teams, assigns tasks and tracks budgets.",
  },
  Accountant: {
    tier: TIERS.WORKER,
    description: "Handles budgets, procurement and finance tasks.",
  },
  Teacher: {
    tier: TIERS.WORKER,
    description: "Executes assigned academic and class tasks.",
  },
  "Class Teacher": {
    tier: TIERS.WORKER,
    description: "Owns a class; handles class-level responsibilities.",
  },
  "Team Member": {
    tier: TIERS.WORKER,
    description: "Contributes to event or department teams.",
  },
};

export function getTier(role: Role | string | undefined | null): Tier {
  if (role && role in ROLE_TIERS) return ROLE_TIERS[role as Role];
  return TIERS.WORKER;
}

export function isOwner(role?: string | null): boolean {
  return getTier(role) === TIERS.OWNER;
}

export function isAdmin(role?: string | null): boolean {
  return getTier(role) === TIERS.ADMIN;
}

export function isWorker(role?: string | null): boolean {
  return getTier(role) === TIERS.WORKER;
}

/** Owner + Admin tiers can reach management areas (users, reports, etc.). */
export function canManage(role?: string | null): boolean {
  const t = getTier(role);
  return t === TIERS.OWNER || t === TIERS.ADMIN;
}

/**
 * Which tiers a given actor is allowed to *see* (and list).
 *   Owner  -> [Owner, Admin, Worker]
 *   Admin  -> [Admin, Worker]
 *   Worker -> []  (only themselves, handled separately)
 */
export function visibleTiers(role?: string | null): Tier[] {
  const t = getTier(role);
  if (t === TIERS.OWNER) return [TIERS.OWNER, TIERS.ADMIN, TIERS.WORKER];
  if (t === TIERS.ADMIN) return [TIERS.ADMIN, TIERS.WORKER];
  return [];
}

/** Roles an actor is allowed to *assign* when creating a new user. */
export function assignableRoles(role?: string | null): Role[] {
  const t = getTier(role);
  if (t === TIERS.OWNER) return [...ROLES];
  if (t === TIERS.ADMIN) return ROLES.filter((r) => ROLE_TIERS[r] === TIERS.WORKER);
  return [];
}

/** Can `actor` create users at all? Owner: anyone. Admin: workers only. */
export function canCreateUsers(role?: string | null): boolean {
  return canManage(role);
}

/**
 * Whether an actor may edit / deactivate / delete a user with `targetRole`.
 *   Owner -> anyone
 *   Admin -> Workers only (not other Admins, not Owners)
 *   Worker -> no one
 * Pure function (client-safe) — also enforced server-side in lib/users.
 */
export function canManageTarget(
  actorRole?: string | null,
  targetRole?: string | null
): boolean {
  const a = getTier(actorRole);
  const t = getTier(targetRole);
  if (a === TIERS.OWNER) return true;
  if (a === TIERS.ADMIN) return t === TIERS.WORKER;
  return false;
}

export const TIER_LABELS: Record<Tier, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  WORKER: "Worker",
};
