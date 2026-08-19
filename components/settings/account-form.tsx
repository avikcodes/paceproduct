"use client";

import { useState, useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInitials } from "@/lib/format";

export function AccountForm() {
  const { user } = useUser();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [isPending, startTransition] = useTransition();

  const dirty = firstName !== user?.firstName || lastName !== user?.lastName;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    startTransition(async () => {
      try {
        await user.update({ firstName, lastName });
        toast.success("Profile updated");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          {user?.imageUrl && (
            <AvatarImage src={user.imageUrl} alt={user.fullName ?? "Your avatar"} />
          )}
          <AvatarFallback className="text-base">
            {getInitials(
              `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "P",
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text-sm font-medium text-foreground">
            {user?.fullName ?? "Your name"}
          </p>
          <p className="text-xs text-muted-foreground">Your public profile</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="first-name">First name</Label>
          <Input
            id="first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="last-name">Last name</Label>
          <Input
            id="last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || isPending}
          onClick={() => {
            setFirstName(user?.firstName ?? "");
            setLastName(user?.lastName ?? "");
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!dirty || isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
