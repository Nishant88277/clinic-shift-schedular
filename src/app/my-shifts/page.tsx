import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { ActionForm } from "@/components/ActionForm";
import { unclaimShiftAction } from "@/app/actions";
import { formatInTimeZone } from "@/lib/format";
import { requirementsSummary } from "@/lib/coverage";

export default async function MyShiftsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "staff") redirect("/dashboard");

  const claims = await prisma.shiftClaim.findMany({
    where: { userId: session.user.id },
    include: { shift: true },
    orderBy: { shift: { startAt: "asc" } },
  });

  return (
    <div className="shell">
      <AppNav />
      <h1>My shifts</h1>
      <p className="muted">Shifts you have claimed.</p>
      <div className="panel">
        {claims.length === 0 && <p className="muted">No claims yet. Browse open shifts to claim one.</p>}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Requirements</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/shifts/${c.shiftId}`}>{formatInTimeZone(c.shift.startAt)}</Link>
                    <div className="muted">to {formatInTimeZone(c.shift.endAt)}</div>
                  </td>
                  <td>{requirementsSummary(c.shift)}</td>
                  <td>
                    <ActionForm action={unclaimShiftAction}>
                      <input type="hidden" name="shiftId" value={c.shiftId} />
                      <input type="hidden" name="staffUserId" value={session.user.id} />
                      <button className="btn secondary" type="submit">
                        Unclaim
                      </button>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
