"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="btn secondary"
      style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem", marginLeft: "0.4rem" }}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
