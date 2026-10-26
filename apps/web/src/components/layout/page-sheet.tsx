import * as React from "react";
import { cn } from "@/lib/cn";

export interface PageSheetProps {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  /** `reading` (default): lesson prose at the 68ch measure. `full`: report and table pages use the sheet's width
   * (look sheet M1); a reading measure there wraps tables and stacks their controls. */
  measure?: "reading" | "full";
  className?: string;
}

export function PageSheet({ children, toolbar, measure = "reading", className }: PageSheetProps) {
  return (
    <article
      data-slot="page-sheet"
      className={cn(
        "bg-panel border-hair max-w-full min-w-0 rounded-xl border shadow-[var(--shadow-e2)]",
        className,
      )}
    >
      {toolbar ? (
        <div data-slot="toolbar" className="border-hair border-b px-3 py-2 [&:has(>:empty)]:hidden">
          {toolbar}
        </div>
      ) : null}
      <div
        data-slot="reading-column"
        data-measure={measure}
        className={cn(measure === "reading" ? "mx-auto max-w-[68ch] px-8 py-6" : "px-6 py-5", "max-sm:px-4")}
      >
        {children}
      </div>
    </article>
  );
}
