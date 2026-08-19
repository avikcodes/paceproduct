import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free Pace account and start running your agency on numbers you trust.",
};

export default function SignUpPage() {
  return <SignUp fallbackRedirectUrl="/onboarding" signInUrl="/sign-in" />;
}
