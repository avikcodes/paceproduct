import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["ACTIVE", "ON_HOLD"] as const;

export const hasActiveSubscription = cache(
  async (userId: string): Promise<boolean> => {
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });

    if (!subscription) return false;
    return ACTIVE_STATUSES.includes(
      subscription.status as (typeof ACTIVE_STATUSES)[number],
    );
  },
);
