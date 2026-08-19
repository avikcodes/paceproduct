import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateWorkspaceForm } from "@/components/onboarding/create-workspace-form";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Create your workspace",
  description: "Set up your Pace workspace.",
};

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const existing = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (existing) {
    redirect("/dashboard");
  }

  return <CreateWorkspaceForm />;
}
