import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { ImportUploader } from "@/components/ImportUploader";

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "manager") redirect("/shifts");

  return (
    <div className="shell">
      <AppNav />
      <h1>Import CSV</h1>
      <p className="muted">
        Uses the same cleaning rules as the seed importer. You will be taken to the import report
        afterward.
      </p>
      <div className="panel">
        <ImportUploader />
      </div>
    </div>
  );
}
