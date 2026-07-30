# Decisions

## Stack

Chose **Next.js + Prisma + SQLite** so local setup stays one command (`npm run setup` or `docker compose up`) without needing a separate database service. Auth uses **NextAuth credentials** with bcrypt hashes — enough for a take-home without OAuth complexity.

## Editing shifts that already have claims

**Keep claims when they remain valid; reject the edit otherwise.**

- If new requirements would drop below the number of people already claimed for a role, the update is rejected with a clear message (manager must unassign first).
- If new start/end times would overlap another shift a claimed person already has, the update is rejected.
- Claims are **not** silently dropped — that felt surprising for staff who planned around the shift.

## Overnight and odd times

- End clock ≤ start clock (e.g. `22:00`–`06:00` or `16:00`–`00:00`) means the shift ends the **next calendar day**.
- Explicit `+1` on an end time (e.g. `10:00+1`) also means next day.
- Zero-length windows (`12:00`–`12:00`) are rejected.

## Dirty CSV import

Shared parser for seed + UI upload:

**Staff**

- Normalize roles (`RN`, `Physician`, `recep.`, whitespace/case) → doctor / nurse / receptionist.
- Fix `(at)` → `@` in emails; reject invalid emails / empty names / unknown roles (e.g. Janitor).
- Duplicate `staff_id`: keep first, mark later rows **merged**.
- Duplicate email with a different id: **reject** (cannot merge without losing identity).

**Shifts**

- Accept several date formats; prefer day-first for ambiguous `dd/MM` clinic-style dates; reject impossible dates (`2026-02-30`).
- Parse `nurses=…;doctors=…` and light natural language (`two nurses and a doctor`).
- Duplicate `shift_id`: keep first, merge later duplicates.

Every rejected/merged row is stored on an **ImportBatch** for the Import Report page.

## Concurrency

Claims run inside a Prisma `$transaction`: re-read the shift + claims, check capacity and overlap, then insert. Unique `(shiftId, userId)` prevents double-claims. This is “good enough” for SQLite; under heavier load I’d move to Postgres with `SERIALIZABLE` or row locks.

## Coverage dashboard default week

The UI defaults to the first week of **August 2026** (seeded data) so a fresh demo isn’t an empty current calendar week. Managers can jump to any week via the date control.

## What I’d do differently with more time

- Add Postgres + proper optimistic locking / advisory locks for claim races.
- Live updates (SSE or WebSockets) when a shift fills.
- Recurring shifts as a series with per-occurrence overrides.
- Deploy a persistent hosted instance and wire CI for `npm test` + build.
- Stronger E2E tests (Playwright) for the claim race and import report.
