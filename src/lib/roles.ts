export type UserRole = "manager" | "staff";
export type Profession = "doctor" | "nurse" | "receptionist";
export type ImportRowStatus = "accepted" | "rejected" | "merged";
export type ImportKind = "staff" | "shifts";

const ROLE_ALIASES: Record<string, Profession> = {
  doctor: "doctor",
  md: "doctor",
  physician: "doctor",
  nurse: "nurse",
  rn: "nurse",
  "registered nurse": "nurse",
  receptionist: "receptionist",
  reception: "receptionist",
  "recep.": "receptionist",
  recep: "receptionist",
};

export function normalizeProfession(raw: string | undefined | null): Profession | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return ROLE_ALIASES[key] ?? null;
}

export function professionLabel(p: Profession): string {
  switch (p) {
    case "doctor":
      return "Doctor";
    case "nurse":
      return "Nurse";
    case "receptionist":
      return "Receptionist";
  }
}

export function requirementField(
  profession: Profession,
): "reqDoctors" | "reqNurses" | "reqReceptionists" {
  switch (profession) {
    case "doctor":
      return "reqDoctors";
    case "nurse":
      return "reqNurses";
    case "receptionist":
      return "reqReceptionists";
  }
}
