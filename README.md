# School Workforce Management (SWM) Platform

A centralized platform to assign, track, review, approve and evaluate tasks across
all school stakeholders — Chairman, Principal, Coordinators, Managers, Accountants,
Teachers and Team Members. Built with a role-based visibility hierarchy
 
Built so far: authentication + role hierarchy, dashboards, team management, profiles
with photo upload, a full **Tasks** module (multi-assignee lifecycle, subtasks, rich
text, threaded replies, file/voice attachments, Timeliness/Quality/Accuracy
evaluation, audit log), **Analytics**, **Meetings** (with attendance minutes),
**file/voice uploads** (Cloudinary) and  **email notifications** (Resend). Events,
calendar, approvals  and the AI features are still coming soon 
  
## Tech stack

- **Next.js 16** (App Router) + **React 19** + **JavaScript** (JSX)
- **Tailwind CSS v4** + **shadcn/ui** (radix-nova) — fully responsive, light/dark
- **NextAuth / Auth.js v5** — Credentials provider, JWT sessions
- **MongoDB** via **Mongoose** (Atlas or local)
- **bcryptjs** for password hashing, **Zod** + **react-hook-form** for validation

## Prerequisites

- Node.js 20+
- A MongoDB database — a free [Atlas](https://www.mongodb.com/atlas) cluster or a
  local `mongod`

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set your connection string in .env.local
#    MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/school?retryWrites=true&w=majority"
#    AUTH_SECRET=... (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# 3. Seed the demo accounts (optional — they also auto-seed when the DB is empty)
npm run seed

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000 and sign in — or click a one-click demo login on the page.

### Demo accounts (auto-seeded when the users collection is empty)

| Tier   | Email              | Password   |
| ------ | ------------------ | ---------- |
| Owner  | `owner@school.edu` | `owner123` |
| Admin  | `admin@school.edu` | `admin123` |
| Worker | `worker@school.edu`| `worker123`|

Change these from **Profile → Security** after first login. There is **no public
sign-up** — the Owner creates every other account from **Team management**.

> **Atlas note:** `mongodb+srv://` needs an SRV DNS lookup. If your network's
> resolver refuses SRV queries, the app routes DNS through public resolvers
> (8.8.8.8 / 1.1.1.1) automatically — see `src/lib/db.js`. Also allow your IP in
> Atlas → Network Access.

## Role hierarchy

Roles keep their real titles from the requirements document. Each role maps to one
**visibility tier** that controls who can see and manage whom.

| Tier       | Can see / manage              | Roles in this tier                                                         |
| ---------- | ----------------------------- | ------------------------------------------------------------------------- |
| **Owner**  | Everyone                      | Chairman/Director                                                         |
| **Admin**  | Admins + Workers (not Owners) | Principal, Academic Coordinator, Administrative Manager, Event Coordinator |
| **Worker** | Only themselves               | Accountant, Teacher, Class Teacher, Team Member                           |

- **Owner** can create/edit/delete any account and assign any role.
- **Admin** can create/edit/delete **Worker** accounts only.
- **Worker** has no management access and sees only their own data.

To re-map a role to a different tier, edit `ROLE_TIERS` in
[`src/lib/rbac.js`](src/lib/rbac.js).

## Scripts

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Start the dev server               |
| `npm run build`     | Production build                   |
| `npm start`         | Run the production build           |
| `npm run seed`      | Create the Owner bootstrap account |
| `npm run lint`      | ESLint                             |

## Project structure

```
src/
  app/
    login/                 # Public login page
    (app)/                 # Authenticated area (auth-guarded layout)
      dashboard/  profile/  users/  tasks/  meetings/  events/ ...
    api/
      auth/[...nextauth]/  # NextAuth route
      users/  profile/     # REST endpoints (auth + RBAC enforced)
  components/
    ui/                    # shadcn/ui primitives
    app-sidebar, app-header, nav-user, providers, ...
    profile/  users/       # Feature components
  lib/
    auth.js  auth.config.js  # NextAuth (Node) + Edge-safe config
    db.js                    # Cached Mongoose connection (+ SRV DNS fix)
    store.js                 # User repository (MongoDB)
    tasks.js                 # Task data layer + lifecycle state machine
    task-meta.js             # Task statuses/priorities/actions (client-safe)
    demo.js                  # Seed/demo accounts (client-safe)
    rbac.js                  # Roles, tiers, permission helpers
    users.js                 # User data layer (visibility enforced)
    session.js               # Server-side auth guards
    validation.js            # Zod schemas
  models/User.js  models/Task.js   # Mongoose models
  components/tasks/          # Task list, dialog, detail sheet, badges
  proxy.js                   # Edge auth gate (Next 16 "proxy")
scripts/seed.js              # Seed demo accounts + print logins
```

## Security notes

- Passwords are hashed with bcrypt and never returned by the API.
- Every API route re-checks authentication and authorization server-side
  the UI hiding an action is never the only line of defense.
- The Edge `proxy` only verifies the signed session cookie; Mongoose/bcrypt stay
  in the Node runtime (Auth.js split-config pattern).


MONGODB - SHRESTH 
VERCEL - SHRESTH 
GOOGLE SERVICE - 
