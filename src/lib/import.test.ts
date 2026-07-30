import { describe, expect, it } from "vitest";
import { parseFlexibleDate, buildShiftWindow, rangesOverlap } from "@/lib/time";
import { parseRequirements } from "@/lib/requirements";
import { normalizeProfession } from "@/lib/roles";

describe("normalizeProfession", () => {
  it("maps aliases", () => {
    expect(normalizeProfession("RN")).toBe("nurse");
    expect(normalizeProfession("Physician")).toBe("doctor");
    expect(normalizeProfession("recep.")).toBe("receptionist");
    expect(normalizeProfession("Janitor")).toBeNull();
  });
});

describe("parseFlexibleDate", () => {
  it("parses ISO and rejects impossible dates", () => {
    const ok = parseFlexibleDate("2026-08-03");
    expect(ok?.getUTCDate()).toBe(3);
    expect(parseFlexibleDate("2026-02-30")).toBeNull();
  });

  it("parses day-first slash dates", () => {
    const d = parseFlexibleDate("29/08/2026");
    expect(d?.getUTCMonth()).toBe(7);
    expect(d?.getUTCDate()).toBe(29);
  });
});

describe("buildShiftWindow", () => {
  it("handles overnight and +1 end markers", () => {
    const date = parseFlexibleDate("2026-08-08")!;
    const overnight = buildShiftWindow(date, "22:00", "06:00");
    expect("error" in overnight).toBe(false);
    if (!("error" in overnight)) {
      expect(overnight.endAt.getTime()).toBeGreaterThan(overnight.startAt.getTime());
      expect(overnight.endAt.getUTCDate()).toBe(9);
    }

    const plusOne = buildShiftWindow(date, "08:00", "10:00+1");
    expect("error" in plusOne).toBe(false);
    if (!("error" in plusOne)) {
      expect(plusOne.endAt.getUTCDate()).toBe(9);
    }
  });

  it("rejects zero-length shifts", () => {
    const date = parseFlexibleDate("2026-08-15")!;
    const result = buildShiftWindow(date, "12:00", "12:00");
    expect("error" in result).toBe(true);
  });
});

describe("parseRequirements", () => {
  it("parses key=value and natural language", () => {
    expect(parseRequirements("nurses=2;doctors=1;receptionists=0")).toEqual({
      nurses: 2,
      doctors: 1,
      receptionists: 0,
    });
    expect(parseRequirements("two nurses and a doctor")).toEqual({
      nurses: 2,
      doctors: 1,
      receptionists: 0,
    });
  });
});

describe("rangesOverlap", () => {
  it("detects overlap and adjacent non-overlap", () => {
    const a0 = new Date("2026-08-01T09:00:00Z");
    const a1 = new Date("2026-08-01T17:00:00Z");
    const b0 = new Date("2026-08-01T16:00:00Z");
    const b1 = new Date("2026-08-01T20:00:00Z");
    const c0 = new Date("2026-08-01T17:00:00Z");
    const c1 = new Date("2026-08-01T20:00:00Z");
    expect(rangesOverlap(a0, a1, b0, b1)).toBe(true);
    expect(rangesOverlap(a0, a1, c0, c1)).toBe(false);
  });
});
