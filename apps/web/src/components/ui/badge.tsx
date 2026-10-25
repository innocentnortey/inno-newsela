import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function CapsTag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-caps inline-flex h-5 items-center uppercase", className)}>{children}</span>;
}

export function CountBadge({ count }: { count: number }) {
  return (
    <span className="bg-danger-tint text-danger text-label inline-flex size-[22px] items-center justify-center rounded-sm tabular-nums">
      {count}
    </span>
  );
}

export function Marker({ n }: { n: number }) {
  return (
    <span className="bg-danger text-on-danger text-micro inline-flex size-5 items-center justify-center rounded-full tabular-nums">
      {n}
    </span>
  );
}

export function VersionChip({ version }: { version: string }) {
  return <span className="bg-well rounded-xs px-1.5 py-px font-mono text-[12px] font-semibold">{version}</span>;
}

export function CodeChip({ children }: { children: ReactNode }) {
  return <span className="bg-well rounded-xs px-1.5 py-px font-mono text-[12px] whitespace-nowrap">{children}</span>;
}
