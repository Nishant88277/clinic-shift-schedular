import type { Shift, ShiftClaim, User } from "@prisma/client";
import type { Profession } from "@/lib/roles";
import { formatInTimeZone } from "./format";

export type ShiftWithClaims = Shift & {
  claims: (ShiftClaim & { user: User })[];
};

export function countByProfession(shift: ShiftWithClaims): Record<Profession, number> {
  const counts: Record<Profession, number> = { doctor: 0, nurse: 0, receptionist: 0 };
  for (const c of shift.claims) {
    if (c.user.profession) counts[c.user.profession as Profession] += 1;
  }
  return counts;
}

export type RoleFill = {
  key: Profession;
  label: string;
  filled: number;
  required: number;
  missing: number;
};

export function roleFills(shift: ShiftWithClaims): RoleFill[] {
  const counts = countByProfession(shift);
  const rows: RoleFill[] = [
    {
      key: "doctor",
      label: "Doctors",
      filled: counts.doctor,
      required: shift.reqDoctors,
      missing: Math.max(0, shift.reqDoctors - counts.doctor),
    },
    {
      key: "nurse",
      label: "Nurses",
      filled: counts.nurse,
      required: shift.reqNurses,
      missing: Math.max(0, shift.reqNurses - counts.nurse),
    },
    {
      key: "receptionist",
      label: "Reception",
      filled: counts.receptionist,
      required: shift.reqReceptionists,
      missing: Math.max(0, shift.reqReceptionists - counts.receptionist),
    },
  ];
  return rows.filter((r) => r.required > 0);
}

export function missingRoles(shift: ShiftWithClaims): string[] {
  return roleFills(shift)
    .filter((r) => r.missing > 0)
    .map((r) => `${r.missing} ${r.key}${r.missing > 1 ? "s" : ""}`);
}

export type CoverageStatus = "full" | "partial" | "empty";

export function statusLabel(status: CoverageStatus): string {
  switch (status) {
    case "full":
      return "Fully staffed";
    case "partial":
      return "Partially staffed";
    case "empty":
      return "Empty";
  }
}

export function coverageStatus(shift: ShiftWithClaims): CoverageStatus {
  if (shift.claims.length === 0) return "empty";
  if (missingRoles(shift).length === 0) return "full";
  return "partial";
}

export function formatShiftRange(shift: Shift): string {
  return `${formatInTimeZone(shift.startAt)} → ${formatInTimeZone(shift.endAt)}`;
}

export function requirementsSummary(shift: Shift): string {
  const parts: string[] = [];
  if (shift.reqDoctors) parts.push(`${shift.reqDoctors} doctor${shift.reqDoctors > 1 ? "s" : ""}`);
  if (shift.reqNurses) parts.push(`${shift.reqNurses} nurse${shift.reqNurses > 1 ? "s" : ""}`);
  if (shift.reqReceptionists)
    parts.push(`${shift.reqReceptionists} receptionist${shift.reqReceptionists > 1 ? "s" : ""}`);
  return parts.join(" + ") || "None";
}
