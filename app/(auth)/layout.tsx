import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-blue-50/80 to-transparent"
      />
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <Logo />
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-10 max-w-sm text-center text-sm text-muted-foreground">
        By continuing, you agree to Pace&apos;s{" "}
        <Link
          href="/"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
