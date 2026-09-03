import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const publicRoutes = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/api/webhooks(.*)",
]);

/**
 * Strip non-ASCII characters from Clerk keys.
 *
 * HTTP headers must be ByteStrings (ASCII only). If a Clerk key was
 * accidentally prefixed with a Unicode character such as the bullet "•"
 * (U+2022, code point 8226) when copied from markdown docs, the SDK
 * throws: "Cannot convert argument to a ByteString because the character
 * at index 0 has a value of 8226".
 */
function sanitizeKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[^\x00-\x7F]/g, "");
}

export default clerkMiddleware(
  async (auth, req) => {
    if (publicRoutes(req)) return;

    const { userId, redirectToSignIn } = await auth();

    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  },
  {
    publishableKey: sanitizeKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    secretKey: sanitizeKey(process.env.CLERK_SECRET_KEY),
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
