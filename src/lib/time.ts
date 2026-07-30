import { addDays, isValid, parse } from "date-fns";

export type ParsedTime = {
  hours: number;
  minutes: number;
  nextDay: boolean;
};

/** Parse HH:mm, optionally with +1 day marker (e.g. 10:00+1). */
export function parseClockTime(raw: string | undefined | null): ParsedTime | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const nextDay = /\+1$/.test(trimmed);
  const core = trimmed.replace(/\+1$/, "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(core);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes, nextDay };
}

function utcDate(y: number, m: number, d: number): Date | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    return null; // impossible calendar date (e.g. Feb 30)
  }
  return dt;
}

/**
 * Accept common dirty date formats from the spreadsheet.
 * Ambiguous slash dates use day-first (DD/MM/YYYY) clinic convention.
 */
export function parseFlexibleDate(raw: string | undefined | null): Date | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // yyyy-MM-dd
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) return utcDate(Number(m[1]), Number(m[2]), Number(m[3]));

  // dd/MM/yyyy or MM/dd/yyyy
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12) return utcDate(y, b, a); // must be D/M
    if (b > 12) return utcDate(y, a, b); // must be M/D
    return utcDate(y, b, a); // ambiguous → day-first
  }

  // MM-dd-yyyy or dd-MM-yyyy (when first segment is month-like)
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    // Spreadsheet samples like 08-13-2026 are US month-day
    if (a <= 12 && b <= 31) {
      const us = utcDate(y, a, b);
      if (us) return us;
    }
    if (a > 12) return utcDate(y, b, a);
  }

  // Fallback: date-fns patterns
  for (const fmt of ["yyyy-MM-dd", "dd/MM/yyyy", "MM-dd-yyyy"] as const) {
    const parsed = parse(trimmed, fmt, new Date(Date.UTC(2000, 0, 1)));
    if (!isValid(parsed)) continue;
    return utcDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

export function combineDateAndTime(date: Date, time: ParsedTime): Date {
  let result = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      time.hours,
      time.minutes,
      0,
      0,
    ),
  );
  if (time.nextDay) {
    result = addDays(result, 1);
  }
  return result;
}

/**
 * Build absolute start/end instants.
 * Rules:
 * - end marked +1 → next calendar day
 * - end clock <= start clock (and not already +1) → overnight into next day
 * - zero-length shifts are invalid
 */
export function buildShiftWindow(
  date: Date,
  startRaw: string | undefined | null,
  endRaw: string | undefined | null,
): { startAt: Date; endAt: Date } | { error: string } {
  const start = parseClockTime(startRaw);
  const end = parseClockTime(endRaw);
  if (!start) return { error: "Missing or invalid start_time" };
  if (!end) return { error: "Missing or invalid end_time" };

  const startAt = combineDateAndTime(date, start);
  let endAt = combineDateAndTime(date, end);

  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  if (!end.nextDay && endMinutes === startMinutes) {
    return { error: "Shift end must be after start (zero-length or inverted)" };
  }

  if (!end.nextDay && endMinutes < startMinutes) {
    endAt = addDays(endAt, 1);
  }

  if (endAt.getTime() <= startAt.getTime()) {
    return { error: "Shift end must be after start (zero-length or inverted)" };
  }

  return { startAt, endAt };
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
