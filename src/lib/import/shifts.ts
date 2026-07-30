import { parse } from "papaparse";
import type { PrismaClient } from "@prisma/client";
import { parseFlexibleDate, buildShiftWindow } from "@/lib/time";
import { parseRequirements } from "@/lib/requirements";
import { type RowOutcome, summarize, type ImportReportSummary } from "./types";

type ShiftCsvRow = {
  shift_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  requirements?: string;
};

export async function importShiftsCsv(
  prisma: PrismaClient,
  csvText: string,
  sourceName: string,
): Promise<ImportReportSummary> {
  const parsed = parse<ShiftCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const outcomes: RowOutcome[] = [];
  const seenExternalIds = new Map<string, number>();

  let rowNumber = 1;
  for (const row of parsed.data) {
    rowNumber += 1;
    const rawRow = JSON.stringify(row);
    const externalId = (row.shift_id ?? "").trim();

    if (!externalId) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: "Missing shift_id",
        action: "Skipped row",
      });
      continue;
    }

    if (seenExternalIds.has(externalId)) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "merged",
        reason: `Duplicate shift_id ${externalId} (first seen on row ${seenExternalIds.get(externalId)})`,
        action: "Kept first occurrence; ignored duplicate",
      });
      continue;
    }

    const existing = await prisma.shift.findUnique({ where: { externalId } });
    if (existing) {
      seenExternalIds.set(externalId, rowNumber);
      outcomes.push({
        rowNumber,
        rawRow,
        status: "merged",
        reason: `shift_id ${externalId} already exists in database`,
        action: "Left existing shift unchanged",
      });
      continue;
    }

    const date = parseFlexibleDate(row.date);
    if (!date) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: `Invalid or impossible date: ${row.date ?? "(empty)"}`,
        action: "Skipped row",
      });
      continue;
    }

    const window = buildShiftWindow(date, row.start_time, row.end_time);
    if ("error" in window) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: window.error,
        action: "Skipped row",
      });
      continue;
    }

    const reqs = parseRequirements(row.requirements);
    if ("error" in reqs) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: reqs.error,
        action: "Skipped row",
      });
      continue;
    }

    if (reqs.doctors + reqs.nurses + reqs.receptionists === 0) {
      outcomes.push({
        rowNumber,
        rawRow,
        status: "rejected",
        reason: "Requirements sum to zero — shift needs at least one role slot",
        action: "Skipped row",
      });
      continue;
    }

    await prisma.shift.create({
      data: {
        externalId,
        startAt: window.startAt,
        endAt: window.endAt,
        reqDoctors: reqs.doctors,
        reqNurses: reqs.nurses,
        reqReceptionists: reqs.receptionists,
      },
    });

    seenExternalIds.set(externalId, rowNumber);
    outcomes.push({
      rowNumber,
      rawRow,
      status: "accepted",
      reason: "Valid shift row",
      action: "Created shift",
    });
  }

  return summarize("shifts", sourceName, outcomes);
}
