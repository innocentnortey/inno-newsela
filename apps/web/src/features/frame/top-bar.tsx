"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { api, isApiError } from "@/lib/api-client";
import { clearAllDrafts } from "@/lib/draft-memory";
import { ROLE_LABEL } from "@/lib/roles";
import { AccountMenu } from "./account-menu";
import { BreadcrumbTrail } from "./breadcrumb";
import { useSession } from "./session-context";
import { TopBarSlotHost } from "./top-bar-slot";

/** design.md §4 top bar: breadcrumb at the left, page status (presence, save state) middle-right, account at the right. */
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
        <div className="ml-auto flex min-w-0 items-center gap-4">
          <TopBarSlotHost />
          <span className="bg-well text-ink2 text-label rounded-sm px-2 py-0.5 font-semibold max-sm:hidden">{ROLE_LABEL[role]}</span>
          <AccountMenu name={user.name} roleLabel={ROLE_LABEL[role]} busy={busy} onSignOut={signOut} />
        </div>
      </div>
      {failed ? <Banner level="blocking" title="Couldn't sign out. Try again." /> : null}
    </div>
  );
}
