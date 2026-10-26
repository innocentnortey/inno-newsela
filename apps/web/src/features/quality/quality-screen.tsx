"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { ContextLine } from "./context-line";
import { COPY, unitLabel } from "./copy";
import { RatingCounts } from "./rating-counts";
import { QualityGate } from "./quality-gate";
import { SeededErrors } from "./seeded-errors";
import { TileGroups } from "./tile-groups";
import { useUnitQuality } from "./use-unit-quality";

export function QualityScreen({ unitKey }: { unitKey: string }) {
  return (
    <QualityGate>
      <QualityBody unitKey={unitKey} />
    </QualityGate>
  );
}

function QualityBody({ unitKey }: { unitKey: string }) {
  const q = useUnitQuality(unitKey);
  const board = `/units/${unitKey}/board`;
  const where = unitLabel(unitKey);
  const { data } = q;

  if (q.notFound) return <NotFound what="unit" boardHref={board} where={where} />;
  if (q.loading && !data)
    return (
      <div aria-busy="true">
        <span className="sr-only">{COPY.loading}</span>
        <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-well h-28 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (!data) return <CantLoad thing={COPY.cantLoadThing} onRetry={q.retry} />;
  // CON-10: quality is null when cut #6 fired.
  if (data.quality === null) return <NotFound what="page" boardHref={board} where={where} />;

  const header = <PageHeader eyebrow={COPY.eyebrow} title={COPY.title} meta={<>{where}</>} />;
  if (data.north_star.n === 0)
    return (
      <>
        {header}
        <p className="text-body text-ink2">{COPY.empty}</p>
      </>
    );

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        <ContextLine northStar={data.north_star} />
        <TileGroups tiles={data.quality.tiles} />
        <RatingCounts ratings={data.quality.rating_counts} />
        <SeededErrors seeded={data.quality.seeded_errors} />
      </div>
    </>
  );
}
