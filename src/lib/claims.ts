import type { Prisma, PrismaClient, Shift, User } from "@prisma/client";
import { rangesOverlap } from "@/lib/time";
import { requirementField, type Profession } from "@/lib/roles";

type Db = PrismaClient | Prisma.TransactionClient;

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimError";
  }
}

function requiredFor(shift: Shift, profession: Profession): number {
  return shift[requirementField(profession)];
}

async function assertNoOverlap(
  db: Db,
  userId: string,
  startAt: Date,
  endAt: Date,
  excludeShiftId?: string,
): Promise<void> {
  const claims = await db.shiftClaim.findMany({
    where: {
      userId,
      ...(excludeShiftId ? { shiftId: { not: excludeShiftId } } : {}),
    },
    include: { shift: true },
  });

  for (const claim of claims) {
    if (rangesOverlap(startAt, endAt, claim.shift.startAt, claim.shift.endAt)) {
      throw new ClaimError(
        `Overlaps with another claimed shift (${claim.shift.startAt.toISOString()} – ${claim.shift.endAt.toISOString()})`,
      );
    }
  }
}

/**
 * Claim or assign a staff member onto a shift.
 * Runs inside a transaction so capacity checks stay consistent under concurrent claims.
 */
export async function claimShift(
  prisma: PrismaClient,
  opts: { shiftId: string; staffUserId: string; actor: User },
): Promise<void> {
  const { shiftId, staffUserId, actor } = opts;

  await prisma.$transaction(async (tx) => {
    const staff = await tx.user.findUnique({ where: { id: staffUserId } });
    if (!staff || staff.role !== "staff" || !staff.profession) {
      throw new ClaimError("Target user is not a staff member with a profession");
    }

    if (actor.role === "staff" && actor.id !== staffUserId) {
      throw new ClaimError("Staff can only claim shifts for themselves");
    }

    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: { claims: { include: { user: true } } },
    });
    if (!shift) throw new ClaimError("Shift not found");

    if (shift.claims.some((c) => c.userId === staffUserId)) {
      throw new ClaimError("Already claimed this shift");
    }

    const profession = staff.profession as Profession;
    const needed = requiredFor(shift, profession);
    if (needed <= 0) {
      throw new ClaimError(`This shift does not require any ${profession}s`);
    }

    const current = shift.claims.filter((c) => c.user.profession === profession).length;
    if (current >= needed) {
      throw new ClaimError(
        `Shift already has enough ${profession}s (${current}/${needed})`,
      );
    }

    await assertNoOverlap(tx, staffUserId, shift.startAt, shift.endAt);

    await tx.shiftClaim.create({
      data: { shiftId, userId: staffUserId },
    });
  });
}

export async function unclaimShift(
  prisma: PrismaClient,
  opts: { shiftId: string; staffUserId: string; actor: User },
): Promise<void> {
  const { shiftId, staffUserId, actor } = opts;

  if (actor.role === "staff" && actor.id !== staffUserId) {
    throw new ClaimError("Staff can only unclaim their own shifts");
  }

  const result = await prisma.shiftClaim.deleteMany({
    where: { shiftId, userId: staffUserId },
  });
  if (result.count === 0) {
    throw new ClaimError("No claim found to remove");
  }
}

/**
 * Validate that existing claims still satisfy capacity and no overlaps after a shift time/req edit.
 * Throws ClaimError with a clear message if not.
 */
export async function assertClaimsStillValid(
  prisma: PrismaClient,
  shiftId: string,
  next: {
    startAt: Date;
    endAt: Date;
    reqDoctors: number;
    reqNurses: number;
    reqReceptionists: number;
  },
): Promise<void> {
  const claims = await prisma.shiftClaim.findMany({
    where: { shiftId },
    include: { user: true },
  });

  const byProf: Record<Profession, number> = { doctor: 0, nurse: 0, receptionist: 0 };
  for (const c of claims) {
    if (!c.user.profession) continue;
    byProf[c.user.profession as Profession] += 1;
  }

  if (byProf.doctor > next.reqDoctors) {
    throw new ClaimError(
      `Cannot reduce doctor slots to ${next.reqDoctors}: ${byProf.doctor} already claimed. Unassign staff first.`,
    );
  }
  if (byProf.nurse > next.reqNurses) {
    throw new ClaimError(
      `Cannot reduce nurse slots to ${next.reqNurses}: ${byProf.nurse} already claimed. Unassign staff first.`,
    );
  }
  if (byProf.receptionist > next.reqReceptionists) {
    throw new ClaimError(
      `Cannot reduce receptionist slots to ${next.reqReceptionists}: ${byProf.receptionist} already claimed. Unassign staff first.`,
    );
  }

  for (const c of claims) {
    const otherClaims = await prisma.shiftClaim.findMany({
      where: { userId: c.userId, shiftId: { not: shiftId } },
      include: { shift: true },
    });
    for (const other of otherClaims) {
      if (rangesOverlap(next.startAt, next.endAt, other.shift.startAt, other.shift.endAt)) {
        throw new ClaimError(
          `New times would overlap for ${c.user.name} with another claimed shift. Adjust times or unassign first.`,
        );
      }
    }
  }
}
