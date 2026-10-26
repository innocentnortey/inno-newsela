"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell, type NavSection } from "@/components/layout";
import { AnnounceProvider } from "@/lib/announce";
import { BreadcrumbProvider } from "./breadcrumb";
import { buildNav } from "./nav";
import { NAV_BOTTOM, NAV_ICONS } from "./nav-icons";
import { useNavUnitKey } from "./use-nav-unit";
import { SessionGate } from "./session-gate";
import { useSession } from "./session-context";
import { TopBar } from "./top-bar";
import { TopBarSlotProvider } from "./top-bar-slot";

/** Adds the rail's icons and placement to the role-filtered entries (buildNav stays data-only). */
function withIcons(sections: NavSection[]): NavSection[] {
  return sections.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i, icon: NAV_ICONS[i.id], placement: NAV_BOTTOM.has(i.id) ? "bottom" : "top" })),
  }));
}

function Shell({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const pathname = usePathname() ?? "/";
  const unitKey = useNavUnitKey(pathname);
  return (
    <BreadcrumbProvider>
      <TopBarSlotProvider>
        <AppShell navSections={withIcons(buildNav(role, pathname, undefined, unitKey))} topBar={<TopBar />}>
          {children}
        </AppShell>
      </TopBarSlotProvider>
    </BreadcrumbProvider>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <AnnounceProvider>
      <SessionGate>
        <Shell>{children}</Shell>
      </SessionGate>
    </AnnounceProvider>
  );
}
