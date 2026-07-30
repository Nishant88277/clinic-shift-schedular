# Clinic Shift Scheduler

Next.js app for a small clinic: managers create shifts, staff claim them, and dirty spreadsheet CSVs are imported with a full report.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Prisma 5** + **SQLite** (file DB — easy local/Docker)
- **NextAuth** (credentials)
- **date-fns**, **papaparse**, **bcryptjs**

## Quick start

```bash
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run setup` installs dependencies, creates the SQLite database, and seeds staff/shifts from the CSV imports.

### Environment file (committed on purpose)

A local `.env` is **included in this repository** so reviewers can clone and run without extra setup:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="clinic-shift-scheduler-dev-secret-change-me"
NEXTAUTH_URL="http://localhost:3000"
```

**These are development-only values.** Environment files with secrets are normally **not** committed; this one is tracked deliberately for the take-home so the app runs smoothly out of the box. For a real deployment, generate a new `NEXTAUTH_SECRET` and keep it out of git (use host env vars / `.env.local`, which remains gitignored).

`.env.example` mirrors the same keys if you prefer to recreate the file yourself.

### One-command Docker

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). The image runs migrate + seed at build time.

## Seeded logins

Password for **all** accounts: `password123`

| Role | Email | Notes |
|------|-------|--------|
| Manager | `manager@clinic.test` | Full access |
| Staff (nurse) | `ivy.bell@clinicmail.test` | From imported CSV |
| Staff (doctor) | `marcus.whitfield@clinicmail.test` | From imported CSV |
| Staff (receptionist) | `ben.marchand@clinicmail.test` | From imported CSV |

Any successfully imported staff email works with `password123`. See **Import report** in the UI for rows that were rejected or merged.

## Tests

```bash
npm test
```

## Features

- Auth with `manager` / `staff` roles (staff have doctor / nurse / receptionist)
- Shift create / edit / delete (managers)
- Claim / unclaim with **server-side** capacity + overlap checks (also when managers assign)
- Concurrent-safe claims via Prisma transactions
- Automatic CSV seed import (`data/staff.csv`, `data/shifts.csv`)
- Manager CSV upload + **Import report** page
- Coverage dashboard (week view, jump to any week, missing roles)

## Deploy notes

SQLite is file-based. Prefer hosts with a persistent disk (Fly.io, Render disk, Docker) rather than ephemeral serverless FS (plain Vercel). Cold starts may apply on free tiers.

For production, **do not reuse the committed `.env` secret** — set `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `DATABASE_URL` in the host environment.

## Docs

- [DECISIONS.md](./DECISIONS.md) — product/engineering choices
