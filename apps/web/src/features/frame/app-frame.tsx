"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout";
import { AnnounceProvider } from "@/lib/announce";
import { BreadcrumbProvider } from "./breadcrumb";
import { buildNav } from "./nav";
import { SessionGate } from "./session-gate";
import { useSession } from "./session-context";
import { TopBar } from "./top-bar";

function Shell({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const pathname = usePathname() ?? "/";
  return (
    <BreadcrumbProvider>
      <AppShell navSections={buildNav(role, pathname)} topBar={<TopBar />}>
        {children}
      </AppShell>
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
