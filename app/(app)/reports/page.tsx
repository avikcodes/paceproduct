import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Client profitability and team performance.",
};

export default async function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Reports
      </h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Sign in to view reports. Authentication is being rebuilt.
      </p>
    </div>
  );
}
