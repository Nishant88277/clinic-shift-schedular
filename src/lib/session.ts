import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

/**
 * Resolve the signed-in user for Server Components and Server Actions.
 * Server Actions sometimes don't surface the session via getServerSession alone,
 * so we fall back to reading the JWT from request cookies.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  if (!cookieHeader) return null;

  const token = await getToken({
    req: {
      headers: {
        cookie: cookieHeader,
      },
    } as { headers: { cookie: string } },
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;
  return (typeof token.id === "string" && token.id) || token.sub || null;
}

export async function requireUser(): Promise<User> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireManager(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "manager") throw new Error("FORBIDDEN");
  return user;
}
