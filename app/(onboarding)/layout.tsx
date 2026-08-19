import Link from "next/link";
import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const highlights = [
  {
    icon: Sparkles,
    text: "One workspace for your whole agency",
  },
  {
    icon: Building2,
    text: "Track clients, projects, and time",
  },
  {
    icon: ShieldCheck,
    text: "You're set as the workspace owner",
  },
];

export default function OnboardingLayout({
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
        className="mb-8 inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <Logo />
      </Link>
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-8">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Create your workspace
            </CardTitle>
            <CardDescription className="mt-1.5">
              Name your workspace to get started. You can change it later.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-2">{children}</CardContent>
        </Card>

        <ul className="mx-auto mt-8 flex max-w-sm flex-col gap-2.5">
          {highlights.map((highlight) => (
            <li
              key={highlight.text}
              className="flex items-center gap-2.5 text-sm text-muted-foreground"
            >
              <highlight.icon className="size-4 shrink-0 text-primary" />
              {highlight.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
