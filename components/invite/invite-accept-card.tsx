"use client";

import { useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  email: string | null;
  roleLabel: string;
  expiresAtLabel: string | null;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

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
  }, [isLoaded, isSignedIn, token, router]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isSignedIn) {
    const inviteUrl = `/invite/${token}`;
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Mail className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">You&apos;re invited</CardTitle>
          <CardDescription className="flex flex-col gap-1 text-base">
            {email && <span>{email}</span>}
            <span>
              Will join as <span className="font-medium">{roleLabel}</span>
              {expiresAtLabel ? ` · ${expiresAtLabel}` : null}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SignInButton
            forceRedirectUrl={inviteUrl}
            signUpForceRedirectUrl={inviteUrl}
          >
            <Button className="w-full">Sign in</Button>
          </SignInButton>
          <SignUpButton
            forceRedirectUrl={inviteUrl}
            signInForceRedirectUrl={inviteUrl}
          >
            <Button variant="outline" className="w-full">
              Sign up
            </Button>
          </SignUpButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-3 py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Accepting invitation…
        </span>
      </CardContent>
    </Card>
  );
}
