import "server-only";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

export async function ensurePaceUser(clerkUserId: string): Promise<void> {
  await prisma.user.upsert({
    where: { id: clerkUserId },
    update: {},
    create: { id: clerkUserId },
  });
}
