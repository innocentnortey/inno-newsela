"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnnounceProvider } from "@/lib/announce";
import { api } from "@/lib/api-client";
import { DemoAccounts } from "./demo-accounts";
import { resolveLanding } from "./next-param";
import { SignInForm } from "./sign-in-form";

export function SignInScreen({ showDemoAccounts = false }: { showDemoAccounts?: boolean }) {
  const router = useRouter();
  const next = useSearchParams()?.get("next") ?? null;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .GET("/session")
      .then(({ data }) => {
        if (!alive) return;
        if (data) router.replace(resolveLanding(data.user.role, next));
        else setChecked(true);
      })
      .catch(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, [router, next]);

  return (
    <AnnounceProvider>
      <main className="bg-ground min-h-screen grid place-items-center p-4">
        <div className="bg-panel rounded-xl shadow-e2 w-full max-w-[440px] p-6 flex flex-col gap-4">
          <p className="text-title text-ink">Lesson Studio</p>
          <h1 className="text-page text-ink">Sign in</h1>
          {checked ? <SignInForm next={next} /> : <div aria-busy="true" className="min-h-40" />}
          <p className="text-small text-ink2">Staff only. Use your Newsela email.</p>
          {showDemoAccounts ? <DemoAccounts /> : null}
        </div>
      </main>
    </AnnounceProvider>
  );
}
