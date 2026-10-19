## Summary

Round 2 of the Postgraduate Portal improvements (implements the round-2 handoff items): presentations move from the Registrar to the **Faculty Admin** (with venue), the outcome is recorded as **Recommended / Not recommended**, supervisors get a full **student dossier**, schedule changes are forwarded to the student **and every supervisor**, and students declare **payment slips** (amount / purpose / date / slip) with a payments page and running total.

Built on top of current `Dasika` (includes the merged round 1 + the two later fixes), so this diff shows **only round 2**.

**Migration:** `prisma/migrations/20261019000000_presentation_outcome_venue_payments`

## What changed

### 1. Presentations moved from Registrar to Faculty Admin
- `git mv src/app/(portal)/registrar/presentations → src/app/(portal)/faculty-admin/presentations`; all actions rewritten with **faculty scoping** (applications of other faculties are rejected/hidden).
- **Venue** added to assign, reschedule, every list, and the review page.
- Registrar nav items removed (37 nav targets still resolve); Faculty Admin gains *Presentations* + *Completed Presentations*.
- Registrar dashboard and registration detail are now **read-only** about presentations (date, venue, status, outcome + reason — no action links).
- Main Admin presentations list links to **the application** (`/admin/applications/<id>`) instead of the deleted route.

### 2. Outcome = Recommended / Not recommended
- New `PresentationOutcome` enum; `presentation.venue / outcome / outcome_note / outcome_by_id / decided_at / created_by_faculty_admin_id`; `created_by_admin` is now nullable (presentations are created by faculty admins). Backfill: `is_final = true ⇒ outcome = 'RECOMMENDED'`.
- `approvePresentationResult()` (Faculty Admin) records **Recommended** and completes the registration: student account + temporary password + `PG/<year>/<seq>`, notifies Main Admin and faculty admins.
- `markPresentationNotRecommended(note)` records **Not recommended**, rejects the application (declaration marked REJECTED with the reason), and sends the reason to the **student, every supervisor, the Registrar and the Main Admin** (portal + email).

### 3. Supervisor dossier
- `/supervisor/students/[applicationId]` renders the full `ApplicationReview` (`showPanel={false}`) for supervisors linked to that application.
- *My Students* links to it (**View student**) and shows the presentation date, time and venue.

### 4. Schedule forwarding
- `forwardSchedule()` (`src/lib/schedule.ts`) notifies the student **and every supervisor** (in-app + email) on **assign** and on **reschedule**, including date, time and **venue**.
- Faculty Admin can reschedule (date/time + venue) a not-yet-completed presentation from the presentation page; everyone is notified again.

### 5. Student payments
- New `Payment` model → `payment_slip` table (amount `DECIMAL(12,2)` / purpose / date / slip, indexes + FK).
- Registration wizard *Payment Slips* rows (amount / purpose / date / slip, ≥ 1) with a **live total**; `POST /api/register` creates `Payment` rows **and** keeps `UploadedFile` rows with category `PAYMENT_RECEIPT`, so requirement 13 (payment receipts) is unchanged.
- `/student/payments` lists every slip with a running total; receipts uploaded before this table existed show *amount not declared*.
- Payments also appear in the review packet (*Payment slips* card + total) on every staff screen that shows `ApplicationReview`.

### 6. Student wording
- `/student/presentations` shows **Recommended** (green) / **Not Recommended** (red) / *Completed* / *Scheduled*, plus the venue and the outcome reason.

## Also included
- `src/lib/api-response.ts` (`readApiResponse`) — the login form and the registration wizard now show the real server-side error on 4xx/5xx instead of "Network error".
- `.env.example` (and a `.gitignore` exception) documenting `DATABASE_URL` / `DIRECT_URL` / `SESSION_SECRET` / upload / SMTP variables.
- Supervisor *Mark complete* now notifies the **faculty admins** (the outcome owners) instead of the Registrar.
- Drive-by fixes exposed by running `prisma generate && tsc --noEmit` against the **real** Prisma client (the old sandbox could not run `prisma generate` and used a type stub):
  - `20260920110000_degree_type` migration made idempotent (`ADD COLUMN IF NOT EXISTS`) — it failed on fresh databases because `init` already created `degree_sought.type`, which broke `prisma migrate deploy` before ever reaching the new migration.
  - Real type errors in `admin/applications/page.tsx`, `lib/application-export.ts` and `lib/admin-progress.ts` (enum `in:` filters widened to `string[]`, a stub-era inline annotation) fixed; `npx tsc --noEmit` is now fully clean.

## Verification done here
- `npx prisma generate && npx tsc --noEmit` — **clean** (real Prisma client).
- `npx eslint .` — clean (exit 0).
- Migrations validated against a local PostgreSQL 17: `prisma migrate deploy` applies the whole chain including `20261019000000_presentation_outcome_venue_payments`, and `prisma migrate diff --from-migrations … --to-schema-datamodel` reports an **empty** diff (migrations match the schema exactly).
- Smoke-tested on that database: `payment_slip` rows with totals, nullable `created_by_admin`, `RECOMMENDED` / `NOT_RECOMMENDED` outcomes with `outcome_by_id` / `decided_at`, and the `is_final ⇒ RECOMMENDED` backfill statement.
- All **37** sidebar navigation targets resolve to real pages, including the new `/faculty-admin/presentations*` and `/student/payments`; `/supervisor/students/[applicationId]` is reachable from *My Students*.

## How to test
```bash
npm install
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy     # applies 20261013… + 20261019… (see handoff §3 for the db-push fallback)
npm run dev
```
Logins: `admin@wayamba.lk` / `Admin@123` (admin) · `anuda@gmail.com` / `12345678` (faculty admin) · `Dinu@gmail.com` / `12345678` (registrar) · `pradeep@gmail.com` / `12345678` (supervisor) · `dinu.test@gmail.com` / `12345678` (student).

1. Register a new applicant at `/register` — in *Documents* add two payment slips with amounts and check the live total; submit.
2. Faculty Admin → *Presentations* → *Assign date & venue* → the student and the supervisor both get the date, time and venue (portal + email/console).
3. Supervisor → *My Students* → *View student* → confirm the whole dossier is visible; *Presentations* → *Mark complete*.
4. Faculty Admin → *Presentations* → *Awaiting your outcome* → **Recommended**: the student account and `PG/<year>/<seq>` are created. On another candidate try **Not recommended** with a reason: the application is rejected and the reason reaches the student.
5. Student → *Presentations* shows **Recommended** / **Not Recommended** with the venue; *Payments* shows every slip and the total paid.
6. Registrar → nav has no presentations items; the registration detail page shows the presentation read-only.
