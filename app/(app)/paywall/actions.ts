"use server";

import { getAuthenticatedUserId } from "@/lib/auth";
import { dodo } from "@/lib/dodo";
import { redirect } from "next/navigation";

const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID!;

export async function createCheckoutSession(): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const session = await dodo.checkoutSessions.create({
    product_cart: [
      {
        product_id: DODO_PRODUCT_ID,
        quantity: 1,
      },
    ],
    metadata: { userId },
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`,
    customization: {
      theme: "light",
    },
  });

  if (!session.checkout_url) {
    throw new Error("Failed to create checkout session");
  }

  redirect(session.checkout_url);
}
