import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hasActiveSubscription } from "@/lib/subscription";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ subscribed: false });
  }

  const subscribed = await hasActiveSubscription(userId);
  return NextResponse.json({ subscribed });
}
