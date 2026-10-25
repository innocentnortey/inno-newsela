import type { ReactNode } from "react";

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-body bg-primary text-on-primary hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-(--space-4) font-semibold"
    >
      {children}
    </a>
  );
}
