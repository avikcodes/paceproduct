import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "./actions";

export default function PaywallPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <Logo wordmarkClassName="text-xl" />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Pace
          </h1>
          <p className="text-lg font-medium text-foreground">$249/month</p>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Subscribe to continue using Pace.
        </p>
        <form action={createCheckoutSession}>
          <Button type="submit" size="lg" className="h-10 px-8">
            Subscribe for $249/month
          </Button>
        </form>
      </div>
    </div>
  );
}
