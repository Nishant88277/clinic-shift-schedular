export type RowOutcome = {
  rowNumber: number;
  rawRow: string;
  status: "accepted" | "rejected" | "merged";
  reason: string;
  action: string;
};

export type ImportReportSummary = {
  kind: "staff" | "shifts";
  sourceName: string;
  accepted: number;
  rejected: number;
  merged: number;
  rows: RowOutcome[];
};

export function summarize(kind: "staff" | "shifts", sourceName: string, rows: RowOutcome[]): ImportReportSummary {
  return {
    kind,
    sourceName,
    accepted: rows.filter((r) => r.status === "accepted").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    merged: rows.filter((r) => r.status === "merged").length,
    rows,
  };
}
