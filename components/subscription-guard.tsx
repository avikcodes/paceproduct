"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(pathname === "/paywall");

  useEffect(() => {
    if (pathname === "/paywall") {
      setAllowed(true);
      return;
    }

    let cancelled = false;

    fetch("/api/subscription-check")
      .then((r) => r.json())
      .then((data: { subscribed?: boolean }) => {
        if (cancelled) return;
        if (data.subscribed) {
          setAllowed(true);
        } else {
          router.replace("/paywall");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/paywall");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!allowed) return null;

  return <>{children}</>;
}
