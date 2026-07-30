import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import {
  coverageStatus,
  missingRoles,
  roleFills,
  statusLabel,
  type CoverageStatus,
  type ShiftWithClaims,
} from "@/lib/coverage";
import {
  formatClockUtc,
  formatDateUtc,
  formatWeekHeadingUtc,
  formatWeekdayShortUtc,
} from "@/lib/format";

function startOfUtcWeekMonday(d: Date): Date {
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

function parseWeekParam(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, day));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== mo ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "manager") redirect("/shifts");

  const sp = await searchParams;
  // Default to first week of seeded August 2026 data for a useful demo landing
  let weekStart = startOfUtcWeekMonday(new Date(Date.UTC(2026, 7, 3)));
  const jumped = parseWeekParam(sp.week);
  if (jumped) weekStart = startOfUtcWeekMonday(jumped);

  const weekEnd = addUtcDays(weekStart, 7);
  const prev = formatDateUtc(addUtcDays(weekStart, -7));
  const next = formatDateUtc(addUtcDays(weekStart, 7));

  const shifts = (await prisma.shift.findMany({
    where: {
      startAt: { gte: weekStart, lt: weekEnd },
    },
    include: { claims: { include: { user: true } } },
    orderBy: { startAt: "asc" },
  })) as ShiftWithClaims[];

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addUtcDays(weekStart, i);
    const key = formatDateUtc(day);
    const dayShifts = shifts.filter((s) => formatDateUtc(s.startAt) === key);
    return { day, dayShifts };
  });

  const totals = shifts.reduce(
    (acc, s) => {
      acc[coverageStatus(s)] += 1;
      return acc;
    },
    { full: 0, partial: 0, empty: 0 } as Record<CoverageStatus, number>,
  );

  const weekEndInclusive = addUtcDays(weekStart, 6);
  const weekRangeLabel = `${formatWeekHeadingUtc(weekStart)} – ${formatWeekHeadingUtc(weekEndInclusive)}`;

  return (
    <div className="shell shell-wide">
      <AppNav />

      <header className="dash-top">
        <div className="dash-top-main">
          <div className="dash-title-block">
            <p className="dash-kicker">Manager coverage</p>
            <h1>Week at a glance</h1>
            <p className="dash-range">{weekRangeLabel}</p>
          </div>

          <div className="dash-controls">
            <div className="week-stepper" role="group" aria-label="Week navigation">
              <Link className="stepper-btn" href={`/dashboard?week=${prev}`} aria-label="Previous week">
                ←
              </Link>
              <form action="/dashboard" method="get" className="week-jump">
                <label htmlFor="week" className="sr-only">
                  Jump to week
                </label>
                <input
                  id="week"
                  name="week"
                  type="date"
                  className="week-date"
                  defaultValue={formatDateUtc(weekStart)}
                />
                <button className="stepper-go" type="submit">
                  Go
                </button>
              </form>
              <Link className="stepper-btn" href={`/dashboard?week=${next}`} aria-label="Next week">
                →
              </Link>
            </div>

            <ul className="dash-pills" aria-label="Week staffing summary">
              <li className="pill full">
                <strong>{totals.full}</strong>
                <span>Fully staffed</span>
              </li>
              <li className="pill partial">
                <strong>{totals.partial}</strong>
                <span>Partial</span>
              </li>
              <li className="pill empty">
                <strong>{totals.empty}</strong>
                <span>Empty</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="dash-meta muted">
          {shifts.length} shift{shifts.length === 1 ? "" : "s"} this week · click a shift to assign staff
        </p>
      </header>

      <div className="week-scroll">
        <div className="week-grid">
          {days.map(({ day, dayShifts }) => (
            <section key={formatDateUtc(day)} className="day-col">
              <header className="day-head">
                <h3>{formatWeekdayShortUtc(day)}</h3>
                <span className="day-count">
                  {dayShifts.length === 0
                    ? "No shifts"
                    : `${dayShifts.length} shift${dayShifts.length === 1 ? "" : "s"}`}
                </span>
              </header>

              {dayShifts.map((shift) => {
                const status = coverageStatus(shift);
                const missing = missingRoles(shift);
                const fills = roleFills(shift);
                return (
                  <Link
                    key={shift.id}
                    href={`/shifts/${shift.id}`}
                    className={`cov-card ${status}`}
                  >
                    <div className="cov-card-top">
                      <time className="cov-time">
                        {formatClockUtc(shift.startAt)}–{formatClockUtc(shift.endAt)}
                      </time>
                      <span className={`badge ${status}`}>{statusLabel(status)}</span>
                    </div>

                    <ul className="role-meters" aria-label="Role coverage">
                      {fills.map((r) => (
                        <li key={r.key} className={r.missing > 0 ? "short" : "ok"}>
                          <span className="role-name">{r.label}</span>
                          <span className="role-count">
                            {r.filled}/{r.required}
                          </span>
                          <span className="role-bar" aria-hidden="true">
                            <span
                              style={{
                                width: `${r.required ? Math.min(100, (r.filled / r.required) * 100) : 0}%`,
                              }}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>

                    {missing.length > 0 ? (
                      <p className="cov-missing">
                        <strong>Missing:</strong> {missing.join(", ")}
                      </p>
                    ) : (
                      <p className="cov-ok">All roles covered</p>
                    )}
                  </Link>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
