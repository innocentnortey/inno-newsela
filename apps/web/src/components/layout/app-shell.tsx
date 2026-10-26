"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type NavCount = number;
export interface NavItem {
  id: string;
  label: string;
  href: string;
  count?: NavCount;
  current?: boolean;
  icon?: React.ReactNode;
}
export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}
export interface AppShellProps {
  navSections: NavSection[];
  topBar?: React.ReactNode;
  children: React.ReactNode;
  productName?: string;
}

export function AppShell({
  navSections,
  topBar,
  children,
  productName = "Lesson Studio",
}: AppShellProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="bg-ground text-ink min-h-screen md:grid md:grid-rows-[auto_1fr] md:grid-cols-[var(--layout-nav-rail)_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus,currentColor)]"
      >
        Skip to main content
      </a>
      <div className="md:col-start-1 md:row-span-2 md:row-start-1">
        <div
          className={cn(
            "border-hair bg-panel border-b md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto md:border-r md:border-b-0",
            open ? "block" : "hidden",
          )}
        >
          <nav aria-label="Primary" id="app-nav" className="p-3">
            <p className="text-ink mb-3 font-semibold">{productName}</p>
            {navSections.map((section) => (
              <div key={section.id} className="mb-4">
                {section.label ? (
                  <h2 className="label text-ink3 mb-1 text-xs uppercase">{section.label}</h2>
                ) : null}
                <ul>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        aria-current={item.current ? "page" : undefined}
                        className={cn(
                          "text-ink2 flex items-center gap-2 rounded-md px-2 py-2",
                          item.current && "bg-selected text-ink",
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.count !== undefined ? (
                          <span className="text-ink3 ml-auto text-xs">{item.count}</span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
      <header className="border-hair bg-panel sticky top-0 z-[var(--z-sticky)] flex h-[var(--layout-top-bar)] items-center gap-3 border-b px-4 md:col-start-2 md:row-start-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="app-nav"
          aria-label="Menu"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md px-2 py-1 md:hidden"
        >
          <span aria-hidden="true">≡</span>
        </button>
        <div className="min-w-0 flex-1">{topBar}</div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[var(--layout-content-max)] p-4 outline-none md:col-start-2 md:row-start-2 md:px-8 md:py-6"
      >
        {children}
      </main>
    </div>
  );
}
