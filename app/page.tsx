import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";

import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Pace — Agency profitability platform",
  description:
    "Pace tracks time across every client and project, then turns it into live profitability for modern marketing agencies.",
};

export default async function Home() {
  const { userId } = await auth();
  const getStartedHref = userId ? "/dashboard" : "/sign-up";

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo wordmarkClassName="text-xl" />
        <p className="text-sm text-muted-foreground sm:text-base">
          Agency profitability platform.
        </p>
        <div className="mt-1 flex items-center gap-3">
          <ButtonLink variant="outline" href="/sign-in" className="h-9 px-5">
            Sign in
          </ButtonLink>
          <ButtonLink href={getStartedHref} className="h-9 px-5">
            Get Started
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
