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
  holds statuses/priorities/actions (client-safe). Read-modify-write whole task via
  `findOneAndReplace`.
- These modules use Mongoose — keep them OUT of the Edge `proxy` (it only imports
  `auth.config`, which has no DB).

## Tasks lifecycle
assigned → accepted → in_progress → submitted → completed. Reject sends submitted
back to in_progress with feedback. Reviewer = task assigner or Owner. Approve
requires a Timeliness/Quality/Accuracy evaluation. Every action appends to the
task's `activity` audit log.

## Auth & access model
- **No public sign-up.** Owner/Admin create all accounts in-app. Demo logins:
  owner@school.edu/owner123, admin@school.edu/admin123, worker@school.edu/worker123.
- Auth.js **split config**: `src/lib/auth.config.js` is Edge-safe (no Mongoose) and
  used by `src/proxy.js` (Next 16 renamed `middleware` → `proxy`). The full config
  with the Credentials provider lives in `src/lib/auth.js` (Node runtime).
- Session carries `role` + `tier` (set in the auth `jwt`/`session` callbacks).

## Role hierarchy (the core rule)
- Roles keep PDF titles; each maps to a tier in `src/lib/rbac.js` (`ROLE_TIERS`).
- Tiers: **Owner** (sees all) → **Admin** (sees Admins+Workers, not Owners) →
  **Worker** (only self). Owner manages anyone; Admin manages Workers only.
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
Auth + roles, dashboards, team mgmt, profiles (photo upload), Tasks (multi-assignee
lifecycle, subtasks, rich text, threaded replies, attachments, evaluation, audit log),
Analytics (/reports), Files/voice (Cloudinary), Email (Resend), Meetings.

## Roadmap (still ComingSoon)
Events, Calendar, Approvals, Settings, recurring/reminders, and the AI features.
