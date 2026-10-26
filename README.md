# DoB Innovation & Learning Hub — LMS

Learning and course-commerce platform for Dreams of Bangladesh: online, offline and hybrid batches, daily lessons (video / PDF / slides), live & in-person sessions, attendance, quizzes and assessments, marks, progress, payments with coupons, certificates, notifications and an AI learning assistant.

Built as a **modular monolith** (per the proposal): Next.js 15 App Router + Node.js server actions, PostgreSQL via Prisma, private file storage, role-based access.

## Quick start

```bash
cp .env.example .env         # then set AUTH_SECRET and PAYMENT_SANDBOX_SECRET
npm install                 # .npmrc forces dev deps even if NODE_ENV=production is set in your shell
npm run db:init             # starts a private PostgreSQL cluster on :5433 (./.dev-db) and creates dob_lms
npx prisma migrate deploy   # creates the schema from prisma/migrations
npm run db:seed             # demo data (8 courses, batches, sessions, assessments, payments…)
npm run dev                 # http://localhost:3000
npm run live:dev            # optional: local LiveKit server for DoB Live classes (brew install livekit ffmpeg)
```

Using your own PostgreSQL? Skip `db:init` and point `DATABASE_URL` in `.env` at it.

### Demo accounts (password `Password@123`)

| Role | Email |
|---|---|
| Student | `student@dob.org` |
| Instructor | `arif@dob.org` (also `nusrat@`, `sadia@`, `kamal@`) |
| Admin | `admin@dob.org` |
| Super Admin | `superadmin@dob.org` |

Coupons: `WELCOME20` (20% off Full-Stack), `DOB500` (৳500 off anything), `EARLYBIRD` (expired).

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `AUTH_SECRET` | 32+ char secret for session JWTs |
| `PAYMENT_MODE` | `sandbox` (simulated gateway, development) or `manual` (staff confirm payments; production default) |
| `PAYMENT_SANDBOX_SECRET` | HMAC secret for the sandbox gateway callback |
| `NEXT_PUBLIC_APP_URL` | Public URL (shown on certificates) |
| `ANTHROPIC_API_KEY` | Optional — enables generative AI answers (Claude); without it the assistant answers from curated knowledge |
| `STORAGE_DIR` | Local file storage and live-recording scratch space (default `storage/uploads`; Railway: `/data/storage` on a volume) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Cloudflare R2 storage (production). Files are served through 10-minute signed links; lesson videos upload straight from the browser (up to 3 GB) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email via Resend: class scheduled / live / reminder / replay, payments, certificates, password reset. Without a key emails are logged |
| `AI_MODEL` | Optional — `claude-opus-5-5` (default) or `claude-sonnet-5-5` |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | DoB Live classes. Local dev: `ws://localhost:7880`, `devkey`, `secret` (what `npm run live:dev` uses) |
| `FFMPEG_PATH` | Optional — ffmpeg binary for converting class recordings to MP4 (default `ffmpeg` on `PATH`; without it replays stay WebM) |

## What’s where

```
prisma/schema.prisma        data model (identity, catalogue, delivery, assessment, commerce, credentials, AI, governance)
prisma/seed.ts              demo data
src/middleware.ts           first-line route protection by role
src/lib/                    auth/RBAC, payments, grading, progress & certificates, storage, AI assistant, reports, audit
src/app/actions/            server actions per area: auth, commerce, student, instructor, admin
src/app/(site)/             public site: landing, catalogue, course detail, checkout, sandbox pay, verify
src/app/dashboard/          student workspace
src/app/instructor/         instructor workspace
src/app/admin/              admin console (super-admin-only settings)
src/app/api/files/[id]      brokered, access-checked file downloads
src/app/api/reports/[type]  CSV exports (admin only)
```

### Roles & access
- **Student** — dashboard, enrolled courses, lessons & materials, schedule, quizzes/assignments, marks & feedback, certificates, payments, AI assistant.
- **Instructor** — only courses they’re mapped to: lessons & resources, sessions, attendance, assessments & question bank, grading, results release, announcements.
- **Admin** — users & roles, courses/pricing/instructors, batches, enrollments, payments (verify/refund), coupons, certificates (issue/revoke), reports & CSV, AI knowledge & review queue, announcements, audit log.
- **Super Admin** — everything above plus platform settings and managing administrator accounts.

Every page and server action re-checks the role server-side; middleware is only the first gate. Students can only open files for courses they’re actively enrolled in (or public previews).

### Payments
Checkout prices are always computed on the server (coupon rules, limits, expiry). `PAYMENT_MODE` decides what happens after checkout. In `sandbox` (development) the order goes to a simulated gateway page (`/pay/[id]`) that posts an HMAC-signed callback, verified before the enrollment is activated. In `manual` (the production default) the seat is reserved, the learner sees the instructions from Admin → Settings → Payments, admins are notified, and staff confirm the payment in Admin → Payments. The PayPlus API will replace this once its credentials are available. Free courses enroll instantly. Admins can verify pending payments, refund (cancels access) and enroll learners manually.

### DoB Live — live classes & replays
Online sessions can be hosted **in-app** (“DoB Live”, the default) or on an **external link** (Zoom/Meet). DoB Live runs on [LiveKit](https://livekit.io) (WebRTC):

1. **Schedule:** an instructor creates an online session with hosting “DoB Live”. Learners in the batch are notified.
2. **Waiting room:** `/live/[id]`. The instructor can open the studio `liveHostEarlyMinutes` before start and check camera and mic. Learners can enter the waiting room `liveJoinEarlyMinutes` early, and it switches to the class as soon as the instructor clicks **Go live**.
3. **In class:**
   - Camera, mic and screen share for the instructor.
   - Chat and a Q&A queue (the instructor marks questions answered).
   - Raise hand → **Let speak** gives a learner mic and camera until **End turn**.
   - Mute or remove participants.
   - Learners are listen-only by default.
4. **Recording:** while live, the instructor’s browser composes the class into 1280×720 video and uploads it in 5-second chunks to `/api/live/[id]/recording`:
   - The screen share fills the frame, with the instructor’s camera as picture-in-picture.
   - The video includes the mixed audio of everyone who spoke.
   - Nothing extra is needed on the LiveKit side.
5. **End:**
   - Attendance is computed from presence heartbeats. A learner is PRESENT if they watched at least `livePresentPercent` of the class, LATE if they joined more than `liveLateAfterMinutes` after go-live, and ABSENT otherwise. Manual marks are never overwritten.
   - The recording is transcoded to MP4 and **auto-published** as a “Class recording” material on the session’s lesson. If the session has no lesson, a new “Live class: …” lesson is created, so it becomes part of the course module.
   - Learners are notified.
6. **Replay:**
   - Streaming only, with no download and HTTP Range seeking.
   - Includes a clickable chat and Q&A transcript.
   - Resumes where the learner left off.
   - Watching 80% marks the lesson complete.
   - Access follows `replayScope` (the same batch or every enrolled learner) and `replayRetentionDays`.

All of these policies are in **Admin → Settings → Live classes**. **Admin → Live classes** shows:
- Classes that are live now, where an admin can join as moderator or force-end.
- The next 7 days.
- Every recording, with retry and hide/show.
- Setup status for LiveKit and ffmpeg.

### Certificates
Each course sets rules (min lesson completion %, min attendance %, pass-all-assessments). Learners claim certificates when eligible; admins can issue (or override, audited) and revoke. Every certificate has a printable page and a public verification page at `/verify`.

### AI learning assistant
`src/lib/ai.ts` retrieves curated knowledge entries (course-scoped + platform FAQs) and the learner’s live context (upcoming classes, published lessons, deadlines). With `ANTHROPIC_API_KEY` set, Claude writes a grounded answer constrained to that context (structured output reports whether it could answer); otherwise the best curated answer is returned. Unanswered questions land in **Admin → AI assistant → Review queue**, where staff can answer and add them to the knowledge base.

### Design
- **Public site** — light theme with reflect.app-style ambient motion: slowly rotating “black hole” rings with twinkling stars, a perspective light floor behind the AI demo, a light beam with rising stars, a radar sweep, a glowing sphere, slow testimonial rows. Animations only run while their section is on screen (`InView` + `.rf-run`).
- **Dashboards** — jimo.ai-inspired workspace: navy primary, azure accents, dot-grid canvas, label-over-value tiles, pastel icon chips, breadcrumb top bar with “Ask DoB AI…”, onboarding tour card.

## Scripts

| Script | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:init` / `db:start` / `db:stop` | local dev PostgreSQL cluster |
| `npm run db:push` / `db:seed` / `db:reset` | schema & demo data |
| `npm run typecheck` / `lint` | checks |
| `npm run live:dev` | local LiveKit dev server (`ws://localhost:7880`) |
| `npm run create-admin -- --email … --name "…"` | create the first super admin (production; never run `db:seed` there) |
| `npm run backup` | `pg_dump` → R2 `backups/`, keeps the last 14 (Railway cron, daily) |
| `npm run cron:reminders` | "class starts soon" in-app + email reminders (Railway cron, every 15 min) |

## Deploying to Railway

The repo is ready for Railway: the `Dockerfile` (Node 22 + ffmpeg + pg_dump 18) is picked up automatically. Service settings live in Railway (project `dob-innovation-learning-hub`, region Singapore):

| Service | Settings |
|---|---|
| `web` | volume at `/data`; pre-deploy `npx prisma migrate deploy`; healthcheck `/api/health`; restart on failure |
| `Postgres` | Railway PostgreSQL 18 |
| `backup` | cron `0 20 * * *` (2 am Dhaka) → `npm run backup` |
| `reminders` | cron `*/15 * * * *` → `npm run cron:reminders` |

Variables are set on `web`; `backup` and `reminders` reference them (`${{web.R2_BUCKET}}` etc.), so each key is entered once.

First admin, after the first deploy: `railway ssh -s web` → `npm run create-admin -- --email you@… --name "…"`.

## Production notes
- Payments run in `manual` mode until the PayPlus API is connected: learners reserve a seat, staff send the payment link and confirm the payment in Admin → Payments. The sandbox page refuses to confirm anything outside `sandbox` mode.
- R2 bucket CORS must allow `PUT` (direct video uploads) and `GET`/`HEAD` from the site's domain.
- DoB Live needs LiveKit over TLS (`wss://`): LiveKit Cloud, or a self-hosted server on a VPS (Railway doesn't expose the UDP ports WebRTC needs).
- The login/register rate limiter is in-memory; use Redis when running more than one instance.
- Landing-page testimonials are placeholders — replace with real, consented quotes.
