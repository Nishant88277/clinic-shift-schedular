import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "manager" | "staff";
      profession: "doctor" | "nurse" | "receptionist" | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: "manager" | "staff";
    profession?: "doctor" | "nurse" | "receptionist" | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "manager" | "staff";
    profession?: "doctor" | "nurse" | "receptionist" | null;
  }
}
