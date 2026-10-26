"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { unitIdFromKey } from "@/lib/keys";
import { COPY } from "./copy";
import { CoverageGate } from "./coverage-gate";
import { CoverageMatrix } from "./matrix";
import { useCoverage } from "./use-coverage";

function unitLabel(unitKey: string): string {
  const id = unitIdFromKey(unitKey);
  const m = id && /^G(\d+)\.U(\d+)$/.exec(id);
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : unitKey;
}

export function CoverageScreen({ unitKey }: { unitKey: string }) {
  return (
    <CoverageGate>
      <CoverageBody unitKey={unitKey} />
    </CoverageGate>
  );
}

function CoverageBody({ unitKey }: { unitKey: string }) {
  const selected = useSearchParams().get("standard");
  const x = useCoverage(unitKey);
  const shown = Boolean(x.data && x.data.lessons.length > 0);

  useEffect(() => {
    if (!shown || !selected) return;
    const el = Array.from(
      document.querySelectorAll<HTMLElement>("tr[data-code]"),
    ).find((r) => r.dataset.code === selected);
    if (el && typeof el.scrollIntoView === "function")
      el.scrollIntoView({ block: "center" });
  }, [shown, selected]);

  if (x.notFound)
    return (
      <NotFound
        what="unit"
        boardHref={`/units/${unitKey}/board`}
        where={unitLabel(unitKey)}
      />
    );
  if (!x.data && !x.error)
    return (
      <div aria-busy="true">
        <span className="sr-only">{COPY.loading}</span>
        <div aria-hidden className="bg-well h-28 animate-pulse rounded-xl" />
      </div>
    );
  if (!x.data) return <CantLoad thing="coverage" onRetry={x.retry} />;

  return (
    <>
      <PageHeader eyebrow="Unit" title={COPY.title} meta={unitLabel(unitKey)} />
      {x.data.lessons.length === 0 ? (
        <p className="text-body text-ink">{COPY.empty}</p>
      ) : x.data.standards.length === 0 ? (
        <p className="text-body text-ink">{COPY.noStandards}</p>
      ) : (
        <CoverageMatrix data={x.data} unitKey={unitKey} selected={selected} />
      )}
    </>
  );
}
