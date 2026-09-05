import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDodoWebhook } from "@/lib/dodo";

const SUBSCRIPTION_STATUS_MAP: Record<string, string> = {
  "subscription.active": "ACTIVE",
  "subscription.on_hold": "ON_HOLD",
  "subscription.paused": "PAUSED",
  "subscription.cancelled": "CANCELLED",
  "subscription.failed": "FAILED",
  "subscription.expired": "EXPIRED",
  "subscription.past_due": "ACTIVE",
  "subscription.renewed": "ACTIVE",
  "subscription.unpaused": "ACTIVE",
  "subscription.updated": "ACTIVE",
  "subscription.plan_changed": "ACTIVE",
};

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event: Record<string, unknown>;
  try {
    event = verifyDodoWebhook(rawBody, headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType = event.type as string;
  const data = event.data as Record<string, unknown> | undefined;

  if (!eventType || !data) {
    return NextResponse.json({ ok: true });
  }

  const newStatus = SUBSCRIPTION_STATUS_MAP[eventType];
  if (!newStatus) {
    return NextResponse.json({ ok: true });
  }

  const userId = (data.metadata as Record<string, string> | undefined)
    ?.userId as string | undefined;
  const dodoSubscriptionId = data.subscription_id as string | undefined;
  const dodoCustomerId = data.customer_id as string | undefined;
  const dodoProductId = data.product_id as string | undefined;
  const currentPeriodStart = data.current_period_start
    ? new Date(data.current_period_start as string)
    : undefined;
  const currentPeriodEnd = data.current_period_end
    ? new Date(data.current_period_end as string)
    : undefined;
  const cancelAtPeriodEnd = (data.cancel_at_period_end as boolean) ?? false;
  const cancelledAt = data.cancelled_at
    ? new Date(data.cancelled_at as string)
    : undefined;

  if (userId) {
    await prisma.subscription.upsert({
      where: { dodoSubscriptionId: dodoSubscriptionId ?? "__none__" },
      update: {
        status: newStatus as "ACTIVE" | "ON_HOLD" | "PAUSED" | "CANCELLED" | "FAILED" | "EXPIRED",
        dodoCustomerId: dodoCustomerId ?? undefined,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        cancelledAt,
      },
      create: {
        userId,
        dodoSubscriptionId: dodoSubscriptionId ?? undefined,
        dodoCustomerId: dodoCustomerId ?? undefined,
        dodoProductId: dodoProductId ?? process.env.DODO_PRODUCT_ID!,
        status: newStatus as "ACTIVE" | "ON_HOLD" | "PAUSED" | "CANCELLED" | "FAILED" | "EXPIRED",
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        cancelledAt,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
