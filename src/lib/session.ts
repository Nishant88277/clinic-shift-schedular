import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export async function requireUser(): Promise<User> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireManager(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "manager") throw new Error("FORBIDDEN");
  return user;
}
