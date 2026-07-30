"use client";

import { useRouter } from "next/navigation";
import { importCsvAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";

export function ImportUploader() {
  const router = useRouter();

  return (
    <ActionForm
      action={importCsvAction}
      onSuccess={(result) => {
        if (result.batchId) router.push(`/import/report?batch=${result.batchId}`);
        else router.push("/import/report");
      }}
    >
      <div className="field">
        <label htmlFor="kind">CSV type</label>
        <select id="kind" name="kind" required defaultValue="staff">
          <option value="staff">Staff (staff_id, full_name, role, email)</option>
          <option value="shifts">Shifts (shift_id, date, start_time, end_time, requirements)</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="file">CSV file</label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required />
      </div>
      <button className="btn" type="submit">
        Upload &amp; import
      </button>
    </ActionForm>
  );
}
