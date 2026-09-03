"use client";

import { useTransition } from "react";
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
  email: string;
  roleLabel: string;
  expiresAtLabel: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
      </CardContent>
    </Card>
  );
}
