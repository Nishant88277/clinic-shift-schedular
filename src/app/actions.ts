"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManager, requireUser } from "@/lib/session";
import { claimShift, unclaimShift, assertClaimsStillValid, ClaimError } from "@/lib/claims";
import { buildShiftWindow, parseFlexibleDate } from "@/lib/time";
import { importStaffCsv } from "@/lib/import/staff";
import { importShiftsCsv } from "@/lib/import/shifts";

function actionError(e: unknown): { ok: false; error: string } {
  if (e instanceof ClaimError) return { ok: false, error: e.message };
  if (e instanceof Error) {
    if (e.message === "UNAUTHORIZED") return { ok: false, error: "Please sign in" };
    if (e.message === "FORBIDDEN") return { ok: false, error: "Managers only" };
    return { ok: false, error: e.message };
  }
  return { ok: false, error: "Unexpected error" };
}

export async function createShiftAction(formData: FormData) {
  try {
    await requireManager();
    const dateRaw = String(formData.get("date") ?? "");
    const start = String(formData.get("startTime") ?? "");
    const end = String(formData.get("endTime") ?? "");
    const reqDoctors = Number(formData.get("reqDoctors") ?? 0);
    const reqNurses = Number(formData.get("reqNurses") ?? 0);
    const reqReceptionists = Number(formData.get("reqReceptionists") ?? 0);

    const date = parseFlexibleDate(dateRaw);
    if (!date) return { ok: false as const, error: "Invalid date" };
    const window = buildShiftWindow(date, start, end);
    if ("error" in window) return { ok: false as const, error: window.error };
    if (reqDoctors + reqNurses + reqReceptionists <= 0) {
      return { ok: false as const, error: "At least one role requirement is needed" };
    }

    await prisma.shift.create({
      data: {
        startAt: window.startAt,
        endAt: window.endAt,
        reqDoctors,
        reqNurses,
        reqReceptionists,
      },
    });
    revalidatePath("/shifts");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    return actionError(e);
  }
}

export async function updateShiftAction(formData: FormData) {
  try {
    await requireManager();
    const id = String(formData.get("id") ?? "");
    const dateRaw = String(formData.get("date") ?? "");
    const start = String(formData.get("startTime") ?? "");
    const end = String(formData.get("endTime") ?? "");
    const reqDoctors = Number(formData.get("reqDoctors") ?? 0);
    const reqNurses = Number(formData.get("reqNurses") ?? 0);
    const reqReceptionists = Number(formData.get("reqReceptionists") ?? 0);

    const date = parseFlexibleDate(dateRaw);
    if (!date) return { ok: false as const, error: "Invalid date" };
    const window = buildShiftWindow(date, start, end);
    if ("error" in window) return { ok: false as const, error: window.error };
    if (reqDoctors + reqNurses + reqReceptionists <= 0) {
      return { ok: false as const, error: "At least one role requirement is needed" };
    }

    await assertClaimsStillValid(prisma, id, {
      startAt: window.startAt,
      endAt: window.endAt,
      reqDoctors,
      reqNurses,
      reqReceptionists,
    });

    await prisma.shift.update({
      where: { id },
      data: {
        startAt: window.startAt,
        endAt: window.endAt,
        reqDoctors,
        reqNurses,
        reqReceptionists,
      },
    });
    revalidatePath("/shifts");
    revalidatePath(`/shifts/${id}`);
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteShiftAction(formData: FormData) {
  try {
    await requireManager();
    const id = String(formData.get("id") ?? "");
    await prisma.shift.delete({ where: { id } });
    revalidatePath("/shifts");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (e) {
    return actionError(e);
  }
}

export async function claimShiftAction(formData: FormData) {
  try {
    const actor = await requireUser();
    const shiftId = String(formData.get("shiftId") ?? "");
    const staffUserId = String(formData.get("staffUserId") ?? actor.id);
    await claimShift(prisma, { shiftId, staffUserId, actor });
    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shiftId}`);
    revalidatePath("/dashboard");
    revalidatePath("/my-shifts");
    return { ok: true as const };
  } catch (e) {
    return actionError(e);
  }
}

export async function unclaimShiftAction(formData: FormData) {
  try {
    const actor = await requireUser();
    const shiftId = String(formData.get("shiftId") ?? "");
    const staffUserId = String(formData.get("staffUserId") ?? actor.id);
    await unclaimShift(prisma, { shiftId, staffUserId, actor });
    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shiftId}`);
    revalidatePath("/dashboard");
    revalidatePath("/my-shifts");
    return { ok: true as const };
  } catch (e) {
    return actionError(e);
  }
}

export async function importCsvAction(formData: FormData) {
  try {
    const manager = await requireManager();
    const kind = String(formData.get("kind") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false as const, error: "No file uploaded" };
    const text = await file.text();
    const sourceName = file.name || "upload.csv";

    const summary =
      kind === "staff"
        ? await importStaffCsv(prisma, text, sourceName)
        : kind === "shifts"
          ? await importShiftsCsv(prisma, text, sourceName)
          : null;

    if (!summary) return { ok: false as const, error: "kind must be staff or shifts" };

    const batch = await prisma.importBatch.create({
      data: {
        kind: summary.kind,
        sourceName: summary.sourceName,
        accepted: summary.accepted,
        rejected: summary.rejected,
        merged: summary.merged,
        createdById: manager.id,
        rows: {
          create: summary.rows.map((r) => ({
            rowNumber: r.rowNumber,
            rawRow: r.rawRow,
            status: r.status,
            reason: r.reason,
            action: r.action,
          })),
        },
      },
    });

    revalidatePath("/import");
    revalidatePath("/import/report");
    revalidatePath("/shifts");
    revalidatePath("/dashboard");
    return { ok: true as const, batchId: batch.id };
  } catch (e) {
    return actionError(e);
  }
}
