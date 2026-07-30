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

## Deploy (Render — recommended)

This app uses **SQLite** (seeded in the Docker image). Deploy as a **Docker Web Service** — not plain Vercel (ephemeral/read-only filesystem breaks claims).

### Steps (about 5–10 minutes)

1. Go to [https://render.com](https://render.com) and sign in with GitHub.
2. **New → Blueprint** (uses `render.yaml`) **or** **New → Web Service** and select  
   `Nishant88277/clinic-shift-schedular`.
3. Settings if not using the Blueprint:
   - **Runtime:** Docker
   - **Branch:** `main`
   - **Instance:** Free
4. Environment variables:
   - `DATABASE_URL` = `file:/app/prisma/dev.db`
   - `NEXTAUTH_SECRET` = any long random string (Render can generate one)
   - `NEXTAUTH_URL` = your public URL, e.g. `https://clinic-shift-schedular.onrender.com`  
     (set this **after** Render shows the URL, then save & redeploy once)
5. Deploy. First build can take several minutes (install + seed + `next build`).

### After deploy

- Open the Render URL and sign in with the seeded accounts below.
- **Cold starts:** the free tier spins down after idle time; the first request may take 30–60+ seconds. Note this for reviewers.

### Other hosts

| Host | Fit |
|------|-----|
| **Render** (Docker) | Best simple path with this repo |
| **Fly.io** | Good if you want a persistent volume |
| **Railway** | Works with Docker |
| **Vercel alone** | Not recommended with SQLite file DB |

## Docs

- [DECISIONS.md](./DECISIONS.md) — product/engineering choices
- [render.yaml](./render.yaml) — Render Blueprint config