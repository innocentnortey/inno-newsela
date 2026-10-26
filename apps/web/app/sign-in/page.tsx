import { Suspense } from "react";
import { SignInScreen } from "@/features/sign-in/sign-in-screen";

export const metadata = { title: "Sign in · Lesson Studio" };
// Read at request time so a container started with DEMO_ACCOUNTS=1 shows the box without a rebuild.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  const showDemoAccounts = process.env.DEMO_ACCOUNTS === "1" || process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "1";
  return (
    <Suspense>
      <SignInScreen showDemoAccounts={showDemoAccounts} />
    </Suspense>
  );
}
