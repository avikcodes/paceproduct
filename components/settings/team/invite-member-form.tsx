"use client";

import { useActionState, useEffect, useState } from "react";
import { Copy, Loader2, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteMember, type TeamActionState } from "@/app/(app)/settings/team/actions";
import { EMAIL_REGEX } from "@/lib/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function InviteMemberForm() {
  const [state, formAction, isPending] = useActionState<TeamActionState, FormData>(
    inviteMember,
    {},
  );
  const [email, setEmail] = useState("");
  const { error, success, inviteLink, emailWarning } = state;

  const invalid = Boolean(email) && !EMAIL_REGEX.test(email);

  useEffect(() => {
    if (error) toast.error(error);
    if (success) toast.success(success);
  }, [error, success]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (invalid) {
      event.preventDefault();
      toast.error("Please enter a valid email address.");
    }
  }

  async function onCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invitation link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailPlus className="size-4 text-muted-foreground" />
          Invite members
        </CardTitle>
        <CardDescription>
          Invite teammates to your workspace by email. They&apos;ll receive a
          link to join with their role.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          action={formAction}
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="invite-email" className="sr-only">
                Email address
              </Label>
              <Input
                key={success ?? "idle"}
                id="invite-email"
                name="email"
                type="email"
                inputMode="email"
                placeholder="teammate@example.com"
                autoComplete="off"
                value={success ? "" : email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error) || invalid}
                aria-describedby={
                  error || invalid ? "invite-email-error" : undefined
                }
                className={cn("h-9", invalid && "aria-invalid:border-destructive")}
              />
              {(error || invalid) && (
                <p id="invite-email-error" role="alert" className="text-sm text-destructive">
                  {invalid ? "Please enter a valid email address." : error}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" className="h-9" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Inviting…
                </>
              ) : (
                <>
                  <MailPlus />
                  Invite
                </>
              )}
            </Button>
          </div>
        </form>
        {emailWarning && inviteLink && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>{emailWarning}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-amber-200 bg-white px-2 py-1 text-xs">
                {inviteLink}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCopyLink}
              >
                <Copy />
                Copy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
