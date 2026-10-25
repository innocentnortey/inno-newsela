import * as React from "react";
import { cn } from "@/lib/cn";

export interface PageSheetProps {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

export function PageSheet({ children, toolbar, className }: PageSheetProps) {
  return (
    <article
      data-slot="page-sheet"
      className={cn(
        "bg-panel border-hair rounded-xl border shadow-[var(--shadow-e2)]",
        className,
      )}
    >
      {toolbar ? (
        <div data-slot="toolbar" className="border-hair border-b px-4 py-2">
          {toolbar}
        </div>
      ) : null}
      <div data-slot="reading-column" className="mx-auto max-w-[68ch] px-8 py-6 max-sm:px-4">
        {children}
      </div>
    </article>
  );
}
