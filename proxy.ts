import { clerkMiddleware } from "@clerk/nextjs/server";

const publicRoutes = ["/", "/sign-in", "/sign-up", "/invite"];

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Optimistic signed-out redirect only. Authorization is enforced at each
  // resource via the DAL (lib/permissions.ts) and API helpers (lib/api-auth.ts).
  if (!isPublicRoute && !pathname.startsWith("/api") && !pathname.startsWith("/trpc")) {
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
