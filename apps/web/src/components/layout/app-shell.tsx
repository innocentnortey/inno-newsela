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
  /** `bottom` pins the item to the foot of the rail (design.md §4: the gear sits at the bottom). */
  placement?: "top" | "bottom";
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

function LogoMark() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14.5 3.5V8H19" />
      <path d="M10 12.5h6M10 16h4" />
    </svg>
  );
}

function FallbackIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function RailLink({ item }: { item: NavItem }) {
  return (
    <li>
      <a
        href={item.href}
        aria-current={item.current ? "page" : undefined}
        className={cn(
          "group text-ink2 relative flex items-center gap-2 rounded-md px-2 py-2",
          "md:text-ink3 md:size-10 md:justify-center md:p-0",
          "hover:bg-well md:hover:text-ink",
          item.current && "bg-selected text-ink md:text-primary hover:bg-selected",
        )}
      >
        <span className="flex size-[18px] shrink-0 items-center justify-center">{item.icon ?? <FallbackIcon />}</span>
        <span className="md:sr-only">{item.label}</span>
        {item.count !== undefined ? <span className="text-ink3 ml-auto text-xs md:sr-only">{item.count}</span> : null}
        {/* Visible name on hover and keyboard focus (the accessible name is the label above). */}
        <span
          aria-hidden="true"
          className={cn(
            "bg-ink text-ground text-label pointer-events-none absolute top-1/2 left-full z-[var(--z-tooltip)] ml-2 hidden -translate-y-1/2",
            "rounded-sm px-2 py-1 whitespace-nowrap md:group-hover:block md:group-focus-visible:block",
          )}
        >
          {item.label}
        </span>
      </a>
    </li>
  );
}

export function AppShell({
  navSections,
  topBar,
  children,
  productName = "Lesson Studio",
}: AppShellProps) {
  const [open, setOpen] = React.useState(false);
  const items = navSections.flatMap((s) => s.items);
  const top = navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.placement !== "bottom") }))
    .filter((s) => s.items.length > 0);
  const bottom = items.filter((i) => i.placement === "bottom");
  return (
    <div className="bg-ground text-ink min-h-screen md:grid md:grid-rows-[auto_1fr] md:grid-cols-[var(--layout-nav-rail)_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus,currentColor)]"
      >
        Skip to main content
      </a>
      <div className="md:bg-panel md:border-hair md:col-start-1 md:row-span-2 md:row-start-1 md:border-r">
        <div
          className={cn(
            "border-hair bg-panel border-b md:sticky md:top-0 md:z-[var(--z-popover)] md:block md:h-screen md:border-b-0",
            open ? "block" : "hidden",
          )}
        >
          <nav aria-label="Primary" id="app-nav" className="flex h-full flex-col p-3 md:items-center md:px-0 md:py-3">
            <p className="text-ink mb-3 flex items-center gap-2 font-semibold md:mb-4">
              <span className="bg-primary text-on-primary flex size-[34px] items-center justify-center rounded-md">
                <LogoMark />
              </span>
              <span className="md:sr-only">{productName}</span>
            </p>
            {top.map((section) => (
              <div key={section.id} className="mb-4 md:mb-1.5">
                {section.label ? (
                  <h2 className="label text-ink3 mb-1 text-xs uppercase md:sr-only">{section.label}</h2>
                ) : null}
                <ul className="flex flex-col gap-1 md:items-center md:gap-1.5">
                  {section.items.map((item) => (
                    <RailLink key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            ))}
            {bottom.length > 0 ? (
              <ul className="mt-auto flex flex-col gap-1 md:items-center md:gap-1.5">
                {bottom.map((item) => (
                  <RailLink key={item.id} item={item} />
                ))}
              </ul>
            ) : null}
          </nav>
        </div>
      </div>
      <header className="border-hair bg-panel sticky top-0 z-[var(--z-sticky)] flex h-[var(--layout-top-bar)] items-center gap-3 border-b px-4 md:col-start-2 md:row-start-1 md:pr-5 md:pl-6">
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
        className="mx-auto w-full max-w-[var(--layout-content-max)] p-4 outline-none md:col-start-2 md:row-start-2 md:px-7 md:py-5"
      >
        {children}
      </main>
    </div>
  );
}
