import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { ActionForm } from "@/components/ActionForm";
import { createShiftAction, claimShiftAction, unclaimShiftAction } from "@/app/actions";
import {
  coverageStatus,
  missingRoles,
  requirementsSummary,
  statusLabel,
  type ShiftWithClaims,
} from "@/lib/coverage";
import { formatClockUtc, formatDateUtc } from "@/lib/format";
import { professionLabel, type Profession } from "@/lib/roles";

const PROFESSION_ORDER: Profession[] = ["doctor", "nurse", "receptionist"];

export default async function ShiftsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const shifts = (await prisma.shift.findMany({
    include: { claims: { include: { user: true } } },
    orderBy: { startAt: "asc" },
  })) as ShiftWithClaims[];

  const staff =
    session.user.role === "manager"
      ? await prisma.user.findMany({
          where: { role: "staff" },
          orderBy: [{ profession: "asc" }, { name: "asc" }],
        })
      : [];

  const staffByProfession = PROFESSION_ORDER.map((p) => ({
    profession: p,
    people: staff.filter((s) => s.profession === p),
  })).filter((g) => g.people.length > 0);

  return (
    <div className="shell shell-wide">
      <AppNav />
      <div className="page-header">
        <div>
          <h1>Shifts</h1>
          <p className="muted page-sub">
            {shifts.length} shift{shifts.length === 1 ? "" : "s"} · claims enforced on the server
          </p>
        </div>
        {session.user.role === "manager" && (
          <a className="btn secondary" href="#create-shift">
            + New shift
          </a>
        )}
      </div>

      {session.user.role === "manager" && (
        <div className="panel" id="create-shift">
          <h2 style={{ marginTop: 0 }}>Create shift</h2>
          <ActionForm action={createShiftAction}>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" name="date" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="startTime">Start</label>
                <input id="startTime" name="startTime" type="time" required defaultValue="09:00" />
              </div>
              <div className="field">
                <label htmlFor="endTime">End</label>
                <input id="endTime" name="endTime" type="time" required defaultValue="17:00" />
              </div>
              <div className="field">
                <label htmlFor="reqDoctors">Doctors needed</label>
                <input id="reqDoctors" name="reqDoctors" type="number" min={0} defaultValue={0} />
              </div>
              <div className="field">
                <label htmlFor="reqNurses">Nurses needed</label>
                <input id="reqNurses" name="reqNurses" type="number" min={0} defaultValue={1} />
              </div>
              <div className="field">
                <label htmlFor="reqReceptionists">Receptionists needed</label>
                <input
                  id="reqReceptionists"
                  name="reqReceptionists"
                  type="number"
                  min={0}
                  defaultValue={0}
                />
              </div>
            </div>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Overnight shifts: set end earlier than start (e.g. 22:00–06:00) and it spans midnight.
            </p>
            <button className="btn" type="submit">
              Create shift
            </button>
          </ActionForm>
        </div>
      )}

      <div className="panel shifts-panel">
        <div className="table-wrap">
          <table className="data shifts-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Requirements</th>
                <th>Status</th>
                <th>Missing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => {
                const status = coverageStatus(shift);
                const missing = missingRoles(shift);
                const mine = shift.claims.find((c) => c.userId === session.user.id);
                const claimedIds = new Set(shift.claims.map((c) => c.userId));
                const startDay = formatDateUtc(shift.startAt);
                const endDay = formatDateUtc(shift.endAt);
                const overnight = startDay !== endDay;

                return (
                  <tr key={shift.id}>
                    <td className="col-when">
                      <Link href={`/shifts/${shift.id}`} className="when-link">
                        <span className="when-date">{startDay}</span>
                        <span className="when-time">
                          {formatClockUtc(shift.startAt)}–{formatClockUtc(shift.endAt)}
                          {overnight ? " (+1)" : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="col-req">{requirementsSummary(shift)}</td>
                    <td className="col-status">
                      <span className={`badge ${status}`}>{statusLabel(status)}</span>
                      <div className="muted claim-count">
                        {shift.claims.length} claimed
                      </div>
                    </td>
                    <td className="col-missing">
                      {missing.length ? (
                        <span className="missing-text">{missing.join(", ")}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="col-actions">
                      <div className="shift-actions">
                        <Link className="btn secondary btn-sm" href={`/shifts/${shift.id}`}>
                          Open
                        </Link>

                        {session.user.role === "staff" && !mine && (
                          <ActionForm action={claimShiftAction} className="inline-form">
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <input type="hidden" name="staffUserId" value={session.user.id} />
                            <button className="btn btn-sm" type="submit">
                              Claim
                            </button>
                          </ActionForm>
                        )}
                        {session.user.role === "staff" && mine && (
                          <ActionForm action={unclaimShiftAction} className="inline-form">
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <input type="hidden" name="staffUserId" value={session.user.id} />
                            <button className="btn secondary btn-sm" type="submit">
                              Unclaim
                            </button>
                          </ActionForm>
                        )}

                        {session.user.role === "manager" && (
                          <ActionForm action={claimShiftAction} className="assign-form">
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <label className="sr-only" htmlFor={`assign-${shift.id}`}>
                              Assign staff
                            </label>
                            <div className="assign-row">
                              <select
                                id={`assign-${shift.id}`}
                                name="staffUserId"
                                className="select-control"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Select staff…
                                </option>
                                {staffByProfession.map((group) => (
                                  <optgroup
                                    key={group.profession}
                                    label={professionLabel(group.profession)}
                                  >
                                    {group.people.map((s) => {
                                      const already = claimedIds.has(s.id);
                                      return (
                                        <option key={s.id} value={s.id} disabled={already}>
                                          {s.name}
                                          {already ? " (already on shift)" : ""}
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                ))}
                              </select>
                              <button className="btn btn-sm" type="submit">
                                Assign
                              </button>
                            </div>
                          </ActionForm>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shifts.length === 0 && (
          <p className="muted" style={{ margin: "0.5rem 0 0" }}>
            No shifts yet. {session.user.role === "manager" ? "Create one above." : ""}
          </p>
        )}
      </div>
    </div>
  );
}