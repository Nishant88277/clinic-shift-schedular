import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export async function AppNav() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const isManager = session.user.role === "manager";

  return (
    <header className="topnav">
      <Link href={isManager ? "/dashboard" : "/shifts"} className="brand">
        Clinic Shift Scheduler
      </Link>
      <nav className="nav-links">
        {isManager && <Link href="/dashboard">Coverage</Link>}
        <Link href="/shifts">Shifts</Link>
        {!isManager && <Link href="/my-shifts">My shifts</Link>}
        {isManager && <Link href="/import">Import</Link>}
        {isManager && <Link href="/import/report">Import report</Link>}
      </nav>
      <div className="user-chip">
        {session.user.name} · {session.user.role}
        {session.user.profession ? ` (${session.user.profession})` : ""}{" "}
        <SignOutButton />
      </div>
    </header>
  );
}
