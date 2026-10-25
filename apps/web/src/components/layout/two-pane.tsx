import * as React from "react";
import { cn } from "@/lib/cn";

export interface TwoPaneProps {
  children: React.ReactNode;
  rail: React.ReactNode;
  railWidth?: "rail" | "rail-narrow";
  className?: string;
}

export function TwoPane({ children, rail, railWidth = "rail", className }: TwoPaneProps) {
  return (
    <div
      data-rail-width={railWidth}
      className={cn(
        "grid grid-cols-1 gap-6",
        railWidth === "rail"
          ? "lg:grid-cols-[minmax(0,1fr)_var(--layout-rail)]"
          : "lg:grid-cols-[minmax(0,1fr)_var(--layout-rail-narrow)]",
        className,
      )}
    >
      <div data-slot="content" className="min-w-0">
        {children}
      </div>
      <div data-slot="rail" className="min-w-0 lg:sticky lg:top-[var(--layout-top-bar)] lg:self-start">
        {rail}
      </div>
    </div>
  );
}

export interface SideRailProps {
  title: string;
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
}

export function SideRail({ title, children, narrow, className }: SideRailProps) {
  const id = React.useId();
  return (
    <aside
      aria-labelledby={id}
      data-narrow={narrow ? "true" : undefined}
      className={cn("bg-panel border-hair overflow-y-auto rounded-xl border px-4 py-3", className)}
    >
      <h2 id={id} className="text-ink mb-2 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </aside>
  );
}
