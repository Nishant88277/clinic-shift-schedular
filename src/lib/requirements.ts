export type RequirementCounts = {
  doctors: number;
  nurses: number;
  receptionists: number;
};

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCount(token: string): number | null {
  const n = Number(token);
  if (!Number.isNaN(n) && Number.isInteger(n) && n >= 0) return n;
  const word = WORD_NUMBERS[token.toLowerCase()];
  return word ?? null;
}

function roleFromToken(token: string): keyof RequirementCounts | null {
  const t = token.toLowerCase().replace(/s$/, "");
  if (t === "doctor" || t === "md" || t === "physician") return "doctors";
  if (t === "nurse" || t === "rn") return "nurses";
  if (t === "receptionist" || t === "reception") return "receptionists";
  // plural forms already stripped trailing s; handle nurses/doctors
  if (token.toLowerCase() === "nurses") return "nurses";
  if (token.toLowerCase() === "doctors") return "doctors";
  if (token.toLowerCase() === "receptionists") return "receptionists";
  return null;
}

/**
 * Parse requirement strings like:
 * - nurses=3;doctors=1;receptionists=0
 * - nurses=2;doctors=1
 * - "two nurses and a doctor"
 */
export function parseRequirements(raw: string | undefined | null): RequirementCounts | { error: string } {
  if (raw == null || !raw.trim()) {
    return { error: "Missing requirements" };
  }

  const text = raw.trim();
  const counts: RequirementCounts = { doctors: 0, nurses: 0, receptionists: 0 };

  if (text.includes("=")) {
    const parts = text.split(/[;|,]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return { error: "Could not parse requirements" };

    for (const part of parts) {
      const [keyRaw, valRaw] = part.split("=").map((s) => s.trim());
      if (!keyRaw || valRaw == null || valRaw === "") {
        return { error: `Malformed requirement segment: ${part}` };
      }
      const key = keyRaw.toLowerCase();
      const count = Number(valRaw);
      if (!Number.isInteger(count) || count < 0) {
        return { error: `Invalid count for ${keyRaw}` };
      }
      if (key === "nurses" || key === "nurse") counts.nurses = count;
      else if (key === "doctors" || key === "doctor") counts.doctors = count;
      else if (key === "receptionists" || key === "receptionist") counts.receptionists = count;
      else return { error: `Unknown role key: ${keyRaw}` };
    }
    return counts;
  }

  // Natural language: "two nurses and a doctor"
  const cleaned = text.toLowerCase().replace(/,/g, " ").replace(/\band\b/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  let i = 0;
  let matched = false;
  while (i < tokens.length) {
    const count = parseCount(tokens[i]);
    if (count == null) {
      i += 1;
      continue;
    }
    const role = roleFromToken(tokens[i + 1] ?? "");
    if (!role) {
      i += 1;
      continue;
    }
    counts[role] = count;
    matched = true;
    i += 2;
  }

  if (!matched) return { error: `Unrecognized requirements format: ${text}` };
  return counts;
}
