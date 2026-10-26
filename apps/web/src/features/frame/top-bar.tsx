"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api-client";
import { clearAllDrafts } from "@/lib/draft-memory";
import { ROLE_LABEL } from "@/lib/roles";
import { BreadcrumbTrail } from "./breadcrumb";
import { useSession } from "./session-context";

export function TopBar() {
  const { user, role } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      await api.DELETE("/session");
    } catch (e) {
      if (!(isApiError(e) && e.code === "UNAUTHENTICATED")) {
        setFailed(true);
        setBusy(false);
        return;
      }
    }
    clearAllDrafts();
    router.replace("/sign-in");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <BreadcrumbTrail />
        <div className="ml-auto flex shrink-0 items-center gap-3 text-small text-ink">
          <span className="max-sm:sr-only">{user.name}</span>
          <span className="text-ink2">{ROLE_LABEL[role]}</span>
          <Button variant="ghost" size="sm" loading={busy} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
      {failed ? <Banner level="blocking" title="Couldn't sign out. Try again." /> : null}
    </div>
  );
}
