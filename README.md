# Postgraduate Portal — University of Wayamba

Next.js (App Router) + Prisma + Supabase Postgres portal covering the whole
postgraduate registration lifecycle: public registration wizard, student portal,
supervisor portal, faculty admin, registrar and main admin.

## Getting started

```bash
npm install

# .env — see "Environment" below
npx prisma generate
npx prisma migrate deploy   # applies prisma/migrations/*
node prisma/seed.mjs        # seeds the MAIN_ADMIN (admin@wayamba.lk / Admin@123)

npm run dev                 # http://localhost:3000
```

`npm run build` runs `prisma generate` first, so the Prisma engines must be
downloadable on the build machine.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string (Prisma) |
| `AUTH_SECRET` | Secret used to sign the session cookie (jose JWT) |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used in every email link |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Storage bucket `registration-files` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Outgoing mail (falls back to console logging when unset) |

## Roles and home pages

| Role | Home | What they do |
| --- | --- | --- |
| Main Admin | `/admin` | Verify student information ("Form of Recorrection"), request corrections, notify students, approve supervisor portal access, manage faculties/degrees/users, view progress and presentations |
| Faculty Admin | `/faculty-admin` | Check applications in their faculty, communicate errors/corrections to students, endorse progress reports, export to Excel |
| Registrar | `/registrar` | Main handler for applications: new registrations, all applications, notify students, approved list with registration numbers, presentations |
| Supervisor | `/supervisor` | Review progress reports, mark presentations complete, message students — **only after Main Admin approval** |
| Student | `/student` | Requirements checklist, corrections, messages to supervisors, notifications, progress reports, presentations |

## Workflow

1. Applicant completes the public wizard at `/register` (all 13 requirements are
   enforced before submission) → application `ACTIVE`.
2. Faculty Admin / Registrar / Main Admin review it, request corrections and
   notify the student (portal + email).
3. Registrar schedules a presentation; the supervisor marks it complete; the
   Registrar approves the result → application `APPROVED`, student account and
   `PG/<year>/<seq>` registration number are created.
4. Main Admin verifies the registered student's information.
5. Progress reports escalate Supervisor → Faculty Admin → Main Admin. Student
   progress is only tracked once registration is complete.

See `WORKFLOW_IMPLEMENTATION.md` for the detailed flow, notifications and the
October 2026 portal improvements.
