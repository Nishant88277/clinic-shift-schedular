import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { ActionForm } from "@/components/ActionForm";
import {
  updateShiftAction,
  deleteShiftAction,
  claimShiftAction,
  unclaimShiftAction,
} from "@/app/actions";
import {
  coverageStatus,
  missingRoles,
  requirementsSummary,
  type ShiftWithClaims,
} from "@/lib/coverage";
import { toDateInputValue, toTimeInputValue, formatInTimeZone } from "@/lib/format";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const shift = (await prisma.shift.findUnique({
    where: { id },
    include: { claims: { include: { user: true } } },
  })) as ShiftWithClaims | null;
  if (!shift) notFound();

  const staff =
    session.user.role === "manager"
      ? await prisma.user.findMany({ where: { role: "staff" }, orderBy: { name: "asc" } })
      : [];

  const status = coverageStatus(shift);
  const missing = missingRoles(shift);
  const mine = shift.claims.find((c) => c.userId === session.user.id);

  // For overnight shifts, date input uses start date; end time may appear earlier
  const dateValue = toDateInputValue(shift.startAt);
  const startTime = toTimeInputValue(shift.startAt);
  const endTime = toTimeInputValue(shift.endAt);

  return (
    <div className="shell">
      <AppNav />
      <p>
        <Link href="/shifts" className="muted">
          ← All shifts
        </Link>
      </p>
      <h1 style={{ marginBottom: "0.25rem" }}>Shift detail</h1>
      <p className="muted">
        {formatInTimeZone(shift.startAt)} → {formatInTimeZone(shift.endAt)}
      </p>

      <div className="grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Staffing</h2>
          <p>
            <span className={`badge ${status}`}>{status}</span>{" "}
            {requirementsSummary(shift)}
          </p>
          <p>{missing.length ? `Missing: ${missing.join(", ")}` : "Fully staffed"}</p>
          <ul>
            {shift.claims.map((c) => (
              <li key={c.id}>
                {c.user.name} ({c.user.profession})
                {session.user.role === "manager" && (
                  <ActionForm action={unclaimShiftAction} className="stack-actions">
                    <input type="hidden" name="shiftId" value={shift.id} />
                    <input type="hidden" name="staffUserId" value={c.userId} />
                    <button className="btn secondary" type="submit">
                      Remove
                    </button>
                  </ActionForm>
                )}
              </li>
            ))}
            {shift.claims.length === 0 && <li className="muted">No claims yet</li>}
          </ul>

          {session.user.role === "staff" && !mine && (
            <ActionForm action={claimShiftAction}>
              <input type="hidden" name="shiftId" value={shift.id} />
              <input type="hidden" name="staffUserId" value={session.user.id} />
              <button className="btn" type="submit">
                Claim this shift
              </button>
            </ActionForm>
          )}
          {session.user.role === "staff" && mine && (
            <ActionForm action={unclaimShiftAction}>
              <input type="hidden" name="shiftId" value={shift.id} />
              <input type="hidden" name="staffUserId" value={session.user.id} />
              <button className="btn secondary" type="submit">
                Unclaim
              </button>
            </ActionForm>
          )}
          {session.user.role === "manager" && (
            <ActionForm action={claimShiftAction} className="assign-form">
              <input type="hidden" name="shiftId" value={shift.id} />
              <label htmlFor="staffUserId">Assign staff</label>
              <div className="assign-row" style={{ marginTop: "0.35rem" }}>
                <select
                  id="staffUserId"
                  name="staffUserId"
                  className="select-control"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select staff…
                  </option>
                  {staff.map((s) => {
                    const already = shift.claims.some((c) => c.userId === s.id);
                    return (
                      <option key={s.id} value={s.id} disabled={already}>
                        {s.name} ({s.profession})
                        {already ? " — already on shift" : ""}
                      </option>
                    );
                  })}
                </select>
                <button className="btn btn-sm" type="submit">
                  Assign
                </button>
              </div>
            </ActionForm>
          )}
        </div>

        {session.user.role === "manager" && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Edit shift</h2>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              If claims would violate the new times or reduced requirements, the edit is rejected.
              Existing claims are kept when still valid.
            </p>
            <ActionForm action={updateShiftAction}>
              <input type="hidden" name="id" value={shift.id} />
              <div className="field">
                <label htmlFor="date">Date (start day)</label>
                <input id="date" name="date" type="date" required defaultValue={dateValue} />
              </div>
              <div className="field">
                <label htmlFor="startTime">Start</label>
                <input id="startTime" name="startTime" type="time" required defaultValue={startTime} />
              </div>
              <div className="field">
                <label htmlFor="endTime">End</label>
                <input id="endTime" name="endTime" type="time" required defaultValue={endTime} />
              </div>
              <div className="field">
                <label htmlFor="reqDoctors">Doctors</label>
                <input
                  id="reqDoctors"
                  name="reqDoctors"
                  type="number"
                  min={0}
                  defaultValue={shift.reqDoctors}
                />
              </div>
              <div className="field">
                <label htmlFor="reqNurses">Nurses</label>
                <input
                  id="reqNurses"
                  name="reqNurses"
                  type="number"
                  min={0}
                  defaultValue={shift.reqNurses}
                />
              </div>
              <div className="field">
                <label htmlFor="reqReceptionists">Receptionists</label>
                <input
                  id="reqReceptionists"
                  name="reqReceptionists"
                  type="number"
                  min={0}
                  defaultValue={shift.reqReceptionists}
                />
              </div>
              <button className="btn" type="submit">
                Save changes
              </button>
            </ActionForm>

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.25rem 0" }} />
            <ActionForm action={deleteShiftAction}>
              <input type="hidden" name="id" value={shift.id} />
              <button className="btn danger" type="submit">
                Delete shift
              </button>
            </ActionForm>
          </div>
        )}
      </div>
    </div>
  );
}
