import { Suspense } from "react";
import { SignInScreen } from "@/features/sign-in/sign-in-screen";

export const metadata = { title: "Sign in · Lesson Studio" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
