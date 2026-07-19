@AGENTS.md

# SWM Platform — project notes

School Workforce Management. Next.js 16 (App Router) · React 19 · **JavaScript (JSX)**
· Tailwind v4 · shadcn/ui · MongoDB (Mongoose) · NextAuth/Auth.js v5 (Credentials, JWT).
Source is plain JS (no TypeScript); path alias `@/*` via `jsconfig.json`.

## Data: MongoDB (Mongoose)
- Connection: `src/lib/db.js` (cached). It also routes DNS via 8.8.8.8/1.1.1.1 for
  `mongodb+srv` because some local resolvers refuse SRV lookups (ECONNREFUSED).
- App uses a string `id` field on docs (not `_id`); `stripMongo` removes `_id/__v`.
- Users: `src/lib/store.js` (repo) + `models/User.js`. Auto-seeds 3 demo accounts
  when the collection is empty (`src/lib/demo.js`, client-safe).
- Tasks: `src/lib/tasks.js` (data + lifecycle) + `models/Task.js`. `task-meta.js`
  holds statuses/priorities/actions (client-safe). Read-modify-write the whole task
  via `replaceOne`, guarded by a monotonic numeric `rev` for optimistic concurrency
  (a stale write gets a 409). Meetings use the same `rev` pattern.
- These modules use Mongoose — keep them OUT of the Edge `proxy` (it only imports
  `auth.config`, which has no DB).

## Tasks lifecycle
Per-assignee status is `assigned → in_progress → submitted → completed`. Assignees
**cannot close their own work** — they `start` it then `submit` it for review (a
required note + optional **private** files); that emails the assigner. A task can
only be submitted once **all its subtasks are closed**. The reviewer (task
creator OR a manager) then `approve`s it (→ `completed`) or `sendback`s it
(→ `in_progress`, optional reason emailed to the assignee). **Subtasks** carry the
same flow: `todo → in_progress → submitted → done`; the assignee submits, and only
the subtask's **creator** (or the task creator / a manager) approves/sends back.
Task-level status is **derived** (never stored) in `deriveTaskStatus`: `draft` (no
assignees) · `assigned` · `in_progress` · `in_review` (someone submitted, awaiting
approval) · `delayed` (open & past due) · `completed` (all assignees approved AND
no open subtasks) · `cancelled`. `cancel`/`reopen` are open to anyone involved.
Only the creator can edit/delete the task. Every action appends to the `activity`
audit log.

**Visibility of task content lives in one file — `src/lib/task-access.js`** (pure,
client-safe). Submission **files** are the most restricted content: only the
uploader, the task creator (assigner) and the **Admin** (Owner tier) see a
file — Managers who aren't the assigner don't (`canSeeAttachment` → `isOwner`).
Comment **text** stays public. When the **creator** @mentions someone in a
comment it becomes **private** (creator + mentioned + management reviewers via
`isReviewer`, i.e. Admin/Manager), must be ≥ 50 chars, and emails them.
`lib/tasks.js` runs every task it returns through `viewTask(actor, task)` to
strip content the viewer may not see. Bulk-assign by role and a single
group-CC assignment email are also supported.

## File Repository (`/repository`, Admin-only management)
`src/lib/repository.js` + `models/RepoFile.js`. The **Admin** (Owner tier) can
**Save** a submitted file from a task (the Cloudinary asset is **copied** via
`copyAsset` so it's independent of the source), **Share** it with specific people
(`sharedWith`), and **multi-select delete** it permanently (removes the record +
destroys the Cloudinary asset, behind a confirm). Everyone else sees only files
shared with them. Saving/sharing/deleting are all Owner-gated server-side.

## Auth & access model
- **No public sign-up.** Admin/Manager create all accounts in-app. Demo logins:
  owner@school.edu/owner123, admin@school.edu/admin123, worker@school.edu/worker123.
- Auth.js **split config**: `src/lib/auth.config.js` is Edge-safe (no Mongoose) and
  used by `src/proxy.js` (Next 16 renamed `middleware` → `proxy`). The full config
  with the Credentials provider lives in `src/lib/auth.js` (Node runtime).
- Session carries `role` + `tier` (set in the auth `jwt`/`session` callbacks).

## Role hierarchy (the core rule)
- Four roles, in `src/lib/rbac.js` (`ROLES`): **Admin → Manager → Teacher/Staff**
  (Teacher and Staff are the same rank; neither manages the other).
- Each role maps to a visibility tier (`ROLE_TIERS`). The tier keys are legacy
  internal names and no longer match the role names 1:1: tier `OWNER` = role
  **Admin**, tier `ADMIN` = role **Manager**, tier `WORKER` = roles **Teacher**
  and **Staff**.
- Tier rule: **Admin** (sees all) → **Manager** (sees Managers+Teachers/Staff,
  not Admins) → **Teacher/Staff** (only self). Admin manages anyone; Manager
  manages Teachers/Staff only. Only an Admin can appoint/create a Manager
  (`assignableRoles`).
- Visibility/permission helpers are **pure** and live in `rbac.js` so both client
  and server can use them. The data layer (`src/lib/users.js`) re-enforces them
  against the DB; API routes re-check too. UI hiding is never the only guard.

## Conventions
- Server guards: `requireUser` / `requireManager` / `requireOwner` in
  `src/lib/session.js`.
- API errors: throw `AppError(msg, status)` (`src/lib/errors.js`); routes call
  `handleApiError` (`src/lib/api.js`).
- Zod schemas in `src/lib/validation.js` are shared by forms and API routes.
- Never return `passwordHash` (it's `select:false`; DTOs in `users.js` omit it).

## Verify before declaring done
`npm run lint && npm run build` — both must pass.

## Built
lifecycle with **submit-for-review → approve/send-back** (subtasks too — only the
subtask creator closes), bulk-assign by role, subtasks, rich text, threaded
replies, **private submission files**, **private @mention comments**, audit log),
**File Repository** (`/repository`; Admin saves/shares/deletes files), Analytics
(/reports), Files/voice (Cloudinary), Email (Gmail SMTP via nodemailer — HTML;
group-CC assignment + meeting invites + review notices), Web Push (VAPID via
`web-push`; `src/lib/push.js` mirrors `email.js` and fires on the same
task/subtask/meeting events — opt-in per device under Settings → Notifications;
subscriptions in `models/PushSubscription.js`; SW `push`/`notificationclick`
handlers in `public/sw.js`), Meetings (group-CC invite with join **link** +
agenda, messages, decisions/action points any participant can add/close — tracks
**who closed** — open ones surface on the dashboard), Calendar (tasks + meetings +
my subtasks), Settings (profile + password + notifications).

## Roadmap (still ComingSoon)
Events, recurring/reminders, task evaluation scoring (Timeliness/Quality/Accuracy),
forced password change on first login, login rate-limiting, and the AI features.
