import "server-only";
import DodoPayments from "dodopayments";
import crypto from "node:crypto";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: "test_mode",
});

export { dodo };

export function verifyDodoWebhook(
  body: string,
  headers: Record<string, string>,
): Record<string, unknown> {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET!;

  const signature =
    headers["webhook-signature"] ?? headers["svix-signature"];
  const timestamp =
    headers["webhook-timestamp"] ?? headers["svix-timestamp"];
  const msgId = headers["webhook-id"] ?? headers["svix-id"];

  if (!signature || !timestamp || !msgId) {
    throw new Error("Missing webhook verification headers");
  }

  const toSign = `${msgId}.${timestamp}.${body}`;
  const signatureParts = signature.split(" ");

  for (const part of signatureParts) {
    const [version, sig] = part.split(",");
    if (version === "v1" && sig) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(toSign)
        .digest("base64");
      if (
        sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      ) {
        return JSON.parse(body) as Record<string, unknown>;
      }
    }
  }

  throw new Error("Invalid webhook signature");
}
