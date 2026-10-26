"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@/components/ui/link";

export interface Crumb {
  label: string;
  href?: string;
}

interface Ctx {
  crumbs: Crumb[];
  setCrumbs: (c: Crumb[]) => void;
}
const BreadcrumbContext = createContext<Ctx>({ crumbs: [], setCrumbs: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const value = useMemo(() => ({ crumbs, setCrumbs }), [crumbs]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useSetBreadcrumb(crumbs: Crumb[]): void {
  const { setCrumbs } = useContext(BreadcrumbContext);
  const sig = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(JSON.parse(sig) as Crumb[]);
    return () => setCrumbs([]);
  }, [sig, setCrumbs]);
}

export function BreadcrumbTrail() {
  const { crumbs } = useContext(BreadcrumbContext);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-2 overflow-x-clip overflow-y-visible px-1 text-small text-ink2 [overflow-clip-margin:4px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${i}-${c.label}`} className={last ? "flex min-w-0 items-center gap-2" : "flex shrink-0 items-center gap-2"}>
              {!last && c.href ? <Link href={c.href}>{c.label}</Link> : <span className={last ? "truncate" : undefined} aria-current={last ? "page" : undefined}>{c.label}</span>}
              {!last ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
