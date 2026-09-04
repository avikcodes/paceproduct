import type { Metadata } from "next";
import { getInvitationByToken } from "@/lib/invitations";
import { InviteAcceptCard } from "@/components/invite/invite-accept-card";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Join a workspace",
  description: "Accept your invitation to a Pace workspace.",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await getInvitationByToken(token);

  if (!lookup.valid || !lookup.invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation is invalid, has expired, or was already used. Ask
              the workspace owner to send you a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation } = lookup;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            You&apos;ve been invited to
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {invitation.workspaceName}
          </h1>
        </div>
        <InviteAcceptCard
          token={token}
          email={invitation.email ?? null}
          roleLabel={invitation.role === "OWNER" ? "Owner" : "Member"}
          expiresAtLabel={
            invitation.expiresAt
              ? `Valid until ${formatDate(invitation.expiresAt)}`
              : null
          }
        />
      </div>
    </div>
  );
}
