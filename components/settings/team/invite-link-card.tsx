"use client";

import { useActionState, useEffect, useState } from "react";
import { Copy, Link, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateInviteLink,
  revokeInviteLink,
  type InviteLinkState,
} from "@/app/(app)/settings/team/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InviteLinkCard({
  existingLink,
}: {
  existingLink: string | null;
}) {
  const [generateState, generateAction, isGenerating] = useActionState<
    InviteLinkState,
    FormData
  >(generateInviteLink, {});
  const [revokeState, revokeAction, isRevoking] = useActionState<
    InviteLinkState,
    FormData
  >(revokeInviteLink, {});
  const [link, setLink] = useState(existingLink);

  const { error: generateError, success: generateSuccess, inviteLink } = generateState;
  const { error: revokeError, success: revokeSuccess } = revokeState;

  useEffect(() => {
    if (generateError) toast.error(generateError);
    if (generateSuccess) toast.success(generateSuccess);
    if (inviteLink) setLink(inviteLink);
  }, [generateError, generateSuccess, inviteLink]);

  useEffect(() => {
    if (revokeError) toast.error(revokeError);
    if (revokeSuccess) {
      toast.success(revokeSuccess);
      setLink(null);
    }
  }, [revokeError, revokeSuccess]);

  async function onCopyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied to clipboard.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="size-4 text-muted-foreground" />
          Invite link
        </CardTitle>
        <CardDescription>
          Share a reusable link with your team. Anyone with this link can join
          your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {link ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded border bg-muted px-3 py-2 text-sm">
                {link}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCopyLink}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <div className="flex gap-2">
              <form action={revokeAction}>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={isRevoking}
                >
                  {isRevoking ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Revoke link
                </Button>
              </form>
              <form action={generateAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || isRevoking}
                >
                  {isGenerating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Generate new link
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <form action={generateAction}>
            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Link className="size-4" />
                  Generate invite link
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
