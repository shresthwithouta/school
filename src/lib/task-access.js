/**
 * Task access policy — the single source of truth for "who is allowed to see
 * what" on a task. Keep all task visibility rules here so the hierarchy is easy
 * to find and change in one place.
 *
 * Pure and client-safe (imports only rbac.js, no DB). Used by the server data
 * layer (lib/tasks.js filters every task it returns through these) and may be
 * imported by client components to mirror the same checks in the UI. UI hiding
 * is never the only guard — the server is the final authority.
 */
import { canManage, isOwner } from "@/lib/rbac";

// ── WHO IS ALLOWED TO SEE PRIVATE TASK CONTENT ──────────────────────
// Management roles that can review submissions, approve/send-back work, and view
// every private *comment* on any task. Add or remove a role here to change who
// has that oversight. (Mirrors the OWNER + ADMIN management tiers today:
// Chairman/Director, Principal, Manager.)
//
// NOTE: this does NOT grant access to uploaded FILES — those are stricter (see
// canSeeAttachment below): only the uploader, the task creator (assigner) and
// the Chairman/Director see a submission file. Other managers don't.
export const REVIEWER_ROLES = ["Chairman/Director", "Principal", "Manager"];

/** A management reviewer — can review submissions and see private comments. */
export function isReviewer(role) {
  return REVIEWER_ROLES.includes(role) || canManage(role);
}

/**
 * Who may approve / send back a submission on this task: the task creator
 * (assigner) or any management reviewer. Assignees cannot review their own work.
 */
export function canReviewTask(actor, task) {
  return actor.id === task.assignerId || isReviewer(actor.role);
}

/**
 * Whether `actor` may see a submission file. Files are the most sensitive task
 * content, so access is tighter than comments: only the person who uploaded it,
 * the task creator (assigner, who reviews their own task), and the
 * Chairman/Director (Owner — full oversight) can see it. Admins, Principals and
 * Managers who aren't the assigner cannot. The Chairman can additionally *share*
 * a file with anyone via the file Repository (see lib/repository.js).
 */
export function canSeeAttachment(actor, task, att) {
  return (
    att.uploadedById === actor.id ||
    actor.id === task.assignerId ||
    isOwner(actor.role)
  );
}

/**
 * Whether `actor` may see a comment. Public comments (the default — and any
 * legacy comment with no `visibility` field) are visible to everyone who can see
 * the task. A private comment is visible only to its author, the task creator,
 * management reviewers, and the users it explicitly addresses (`audienceIds`,
 * e.g. the people an @mention names).
 */
export function canSeeComment(actor, task, c) {
  if (c.visibility !== "private") return true;
  return (
    c.authorId === actor.id ||
    actor.id === task.assignerId ||
    isReviewer(actor.role) ||
    (c.audienceIds || []).includes(actor.id)
  );
}
