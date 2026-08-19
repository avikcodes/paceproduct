"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { acceptInvitation } from "@/app/invite/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InviteAcceptCard({
  token,
  email,
  roleLabel,
  expiresAtLabel,
}: {
  token: string;
  email: string;
  roleLabel: string;
  expiresAtLabel: string | null;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const invitePath = `/invite/${token}`;
  const signedInEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const emailMatches = Boolean(signedInEmail) && signedInEmail === email.toLowerCase();

  function onAccept() {
    startTransition(async () => {
      const result = await acceptInvitation(token);
      if (result.ok) {
        toast.success(`You've joined ${result.workspaceName}.`);
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Mail className="size-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-xl">You&apos;re invited</CardTitle>
        <CardDescription className="flex flex-col gap-1 text-base">
          <span>{email}</span>
          <span>
            Will join as <span className="font-medium">{roleLabel}</span>
            {expiresAtLabel ? ` · ${expiresAtLabel}` : null}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!isLoaded ? (
          <Button disabled>
            <Loader2 className="animate-spin" />
            Checking your account…
          </Button>
        ) : isSignedIn && emailMatches ? (
          <Button onClick={onAccept} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Accepting…
              </>
            ) : (
              <>
                <CheckCircle2 />
                Accept invitation
              </>
            )}
          </Button>
        ) : isSignedIn ? (
          <>
            <p className="text-center text-sm text-muted-foreground">
              This invitation is for <span className="font-medium text-foreground">{email}</span>. Sign in with that account to accept it.
            </p>
            <Button
              variant="outline"
              render={<a href={`/sign-in?redirect_url=${encodeURIComponent(invitePath)}`} />}
            >
              Switch account
            </Button>
          </>
        ) : (
          <>
            <Button render={<a href={`/sign-in?redirect_url=${encodeURIComponent(invitePath)}`} />}>
              Sign in to accept
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New to Pace?{" "}
              <a
                href={`/sign-up?redirect_url=${encodeURIComponent(invitePath)}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Create an account
              </a>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
