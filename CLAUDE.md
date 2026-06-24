@AGENTS.md

# SWM Platform — project notes

School Workforce Management. Next.js 16 (App Router) · React 19 · Tailwind v4 ·
shadcn/ui · MongoDB (Mongoose) · NextAuth/Auth.js v5 (Credentials, JWT).

## Data: MongoDB (Mongoose)
- Connection: `src/lib/db.ts` (cached). It also routes DNS via 8.8.8.8/1.1.1.1 for
  `mongodb+srv` because some local resolvers refuse SRV lookups (ECONNREFUSED).
- App uses a string `id` field on docs (not `_id`); `stripMongo` removes `_id/__v`.
- Users: `src/lib/store.ts` (repo) + `models/User.ts`. Auto-seeds 3 demo accounts
  when the collection is empty (`src/lib/demo.ts`, client-safe).
- Tasks: `src/lib/tasks.ts` (data + lifecycle) + `models/Task.ts`. `task-meta.ts`
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
- Auth.js **split config**: `src/lib/auth.config.ts` is Edge-safe (no Mongoose) and
  used by `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`). The full config
  with the Credentials provider lives in `src/lib/auth.ts` (Node runtime).
- Session carries `role` + `tier`. Types augmented in `src/types/next-auth.d.ts`.

## Role hierarchy (the core rule)
- Roles keep PDF titles; each maps to a tier in `src/lib/rbac.ts` (`ROLE_TIERS`).
- Tiers: **Owner** (sees all) → **Admin** (sees Admins+Workers, not Owners) →
  **Worker** (only self). Owner manages anyone; Admin manages Workers only.
- Visibility/permission helpers are **pure** and live in `rbac.ts` so both client
  and server can use them. The data layer (`src/lib/users.ts`) re-enforces them
  against the DB; API routes re-check too. UI hiding is never the only guard.

## Conventions
- Server guards: `requireUser` / `requireManager` / `requireOwner` in
  `src/lib/session.ts`.
- API errors: throw `AppError(msg, status)` (`src/lib/errors.ts`); routes call
  `handleApiError` (`src/lib/api.ts`).
- Zod schemas in `src/lib/validation.ts` are shared by forms and API routes.
- Never return `passwordHash` (it's `select:false`; DTOs in `users.ts` omit it).

## Verify before declaring done
`npm run typecheck && npm run lint && npm run build` — all must pass. No DB needed.

## Roadmap (not built yet — render as ComingSoon)
Tasks, Meetings, Events, Calendar, Approvals, Reports, Settings, and the AI features.
