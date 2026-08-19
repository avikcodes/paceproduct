import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Pace workspace.",
};

export default function SignInPage() {
  return <SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" />;
}
