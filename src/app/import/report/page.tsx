import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { formatInTimeZone } from "@/lib/format";

export default async function ImportReportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "manager") redirect("/shifts");

  const sp = await searchParams;
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const selectedId = sp.batch ?? batches[0]?.id;
  const selected = selectedId
    ? await prisma.importBatch.findUnique({
        where: { id: selectedId },
        include: {
          rows: {
            where: { status: { in: ["rejected", "merged"] } },
            orderBy: { rowNumber: "asc" },
          },
        },
      })
    : null;

  return (
    <div className="shell">
      <AppNav />
      <h1>Import report</h1>
      <p className="muted">Accepted counts plus every rejected or merged row.</p>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Batches</h2>
        {batches.length === 0 && <p className="muted">No imports yet.</p>}
        <ul>
          {batches.map((b) => (
            <li key={b.id}>
              <Link href={`/import/report?batch=${b.id}`}>
                {b.sourceName} ({b.kind}) — {formatInTimeZone(b.createdAt)} — accepted {b.accepted},
                rejected {b.rejected}, merged {b.merged}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>
            {selected.sourceName}{" "}
            <span className="muted">
              · accepted {selected.accepted} · rejected {selected.rejected} · merged{" "}
              {selected.merged}
            </span>
          </h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Raw</th>
                  <th>What was wrong</th>
                  <th>What we did</th>
                </tr>
              </thead>
              <tbody>
                {selected.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.rowNumber}</td>
                    <td>{r.status}</td>
                    <td>
                      <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{r.rawRow}</code>
                    </td>
                    <td>{r.reason}</td>
                    <td>{r.action}</td>
                  </tr>
                ))}
                {selected.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No rejected or merged rows in this batch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
