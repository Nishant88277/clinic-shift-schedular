import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/");

  return (
    <main className="login-hero">
      <div className="login-card">
        <h1>Clinic Shift Scheduler</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Managers schedule coverage. Staff claim open shifts.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
