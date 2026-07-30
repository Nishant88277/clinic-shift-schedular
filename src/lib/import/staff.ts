import { parse } from "papaparse";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeProfession } from "@/lib/roles";
import { type RowOutcome, summarize, type ImportReportSummary } from "./types";

const DEFAULT_PASSWORD = "password123";

function normalizeEmail(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let email = raw.trim().toLowerCase();
  if (!email) return null;
  email = email.replace(/\(at\)/gi, "@");
  // basic shape check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeName(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return null;
  return name;
}

type StaffCsvRow = {
  staff_id?: string;
  full_name?: string;
  role?: string;
  email?: string;
};

export async function importStaffCsv(
  prisma: PrismaClient,
  csvText: string,
  sourceName: string,
): Promise<ImportReportSummary> {
  const parsed = parse<StaffCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const outcomes: RowOutcome[] = [];
  const seenExternalIds = new Map<string, number>();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let rowNumber = 1; // header is row 1 conceptually; data starts at 2
  for (const row of parsed.data) {
    rowNumber += 1;
    const rawRow = JSON.stringify(row);
    const externalId = (row.staff_id ?? "").trim();
    const name = normalizeName(row.full_name);
    const email = normalizeEmail(row.email);
    const profession = normalizeProfession(row.role);

    if (!externalId) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: "Missing staff_id",
        action: "Skipped row",
      });
      continue;
    }

    if (!name) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: "Missing or empty full_name",
        action: "Skipped row",
      });
      continue;
    }

    if (!email) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: "Missing or invalid email",
        action: "Skipped row",
      });
      continue;
    }

    if (!profession) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: `Unrecognized or unsupported role: ${row.role ?? "(empty)"}`,
        action: "Skipped row",
      });
      continue;
    }

    if (seenExternalIds.has(externalId)) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "merged",
        reason: `Duplicate staff_id ${externalId} (first seen on row ${seenExternalIds.get(externalId)})`,
        action: "Kept first occurrence; ignored duplicate",
      });
      continue;
    }

    const existingByExternal = await prisma.user.findUnique({ where: { externalId } });
    if (existingByExternal) {
      seenExternalIds.set(externalId, rowNumber);
      outcomes.push({
        rowNumber,
        rawRow,
        status: "merged",
        reason: `staff_id ${externalId} already exists in database`,
        action: "Left existing user unchanged",
      });
      continue;
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: `Email ${email} already used by another user`,
        action: "Skipped row to avoid email collision",
      });
      continue;
    }

    await prisma.user.create({
      data: {
        externalId,
        name,
        email,
        profession,
        role: "staff",
        passwordHash,
      },
    });

    seenExternalIds.set(externalId, rowNumber);
    outcomes.push({
      rowNumber,
      rawRow,
      status: "accepted",
      reason: "Valid staff row",
      action: "Created staff user",
    });
  }

  return summarize("staff", sourceName, outcomes);
}
