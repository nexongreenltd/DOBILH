# DoB Innovation & Learning Hub — LMS

Learning and course-commerce platform for Dreams of Bangladesh: online, offline and hybrid batches, daily lessons (video / PDF / slides), live & in-person sessions, attendance, quizzes and assessments, marks, progress, payments with coupons, certificates, notifications and an AI learning assistant.

Built as a **modular monolith** (per the proposal): Next.js 15 App Router + Node.js server actions, PostgreSQL via Prisma, private file storage, role-based access.

## Quick start

```bash
cp .env.example .env         # then set AUTH_SECRET and PAYMENT_SANDBOX_SECRET
npm install                 # .npmrc forces dev deps even if NODE_ENV=production is set in your shell
npm run db:init             # starts a private PostgreSQL cluster on :5433 (./.dev-db) and creates dob_lms
npx prisma db push          # creates the schema
npm run db:seed             # demo data (8 courses, batches, sessions, assessments, payments…)
npm run dev                 # http://localhost:3000
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
| `PAYMENT_SANDBOX_SECRET` | HMAC secret for the sandbox gateway callback |
| `NEXT_PUBLIC_APP_URL` | Public URL (shown on certificates) |
| `ANTHROPIC_API_KEY` | Optional — enables generative AI answers (Claude); without it the assistant answers from curated knowledge |
| `STORAGE_DIR` | Optional — where uploaded files are stored (default `storage/uploads`) |

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
Checkout prices are always computed on the server (coupon rules, limits, expiry). Paid checkouts go to a **sandbox gateway page** (`/pay/[id]`) that stands in for bKash / Nagad / SSLCommerz: it posts an HMAC-signed callback, which is verified before the enrollment is activated. To go live, replace `signCallback`/`verifyCallback` in `src/lib/payments.ts` with the provider’s validation API. Free courses enroll instantly. Admins can verify pending payments, refund (cancels access) and enroll learners manually.

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

## Production notes
- Replace the sandbox gateway with the real provider integration and set strong secrets.
- Swap `src/lib/storage.ts` local driver for S3/R2/GCS (interface is `saveUpload` / `readObject`).
- The login/register rate limiter is in-memory; use Redis when running more than one instance.
- Landing-page testimonials are placeholders — replace with real, consented quotes.
