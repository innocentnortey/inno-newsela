"use client";

import { useSearchParams } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Link } from "@/components/ui/link";
import { PageSheet } from "@/components/layout/page-sheet";
import { TwoPane } from "@/components/layout/two-pane";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { CantLoad, NotFound, StaleBanner } from "@/features/frame/conventions";
import { LinksRail } from "./links-rail";
import { PlanList } from "./plan-list";
import {
  EMPTY_TEXT,
  FAILED_TEXT,
  PLANNING_TEXT,
  planHeading,
  unitLabel,
} from "./plan-copy";
import { PlanSkeleton } from "./plan-skeleton";
import { useUnitPlan } from "./use-unit-plan";

export function UnitPlanScreen({
  unitKey,
  runId,
}: {
  unitKey: string;
  runId: string;
}) {
  useSetBreadcrumb([
    { label: "Units", href: "/units" },
    { label: unitLabel(unitKey), href: `/units/${unitKey}/board` },
    { label: "Unit plan" },
  ]);
  const dayRaw = useSearchParams().get("day");
  const focusDay = dayRaw && /^\d{1,3}$/.test(dayRaw) ? Number(dayRaw) : null;
  const { data, dataAt, stale, error, notFound, retry } = useUnitPlan(runId);
  const board = `/units/${unitKey}/board`;

  if (notFound)
    return (
      <NotFound what="plan" boardHref={board} where={unitLabel(unitKey)} />
    );
  if (!data) {
    if (error) return <CantLoad thing="the unit plan" onRetry={retry} />;
    return <PlanSkeleton />;
  }

  return (
    <TwoPane
      railWidth="rail-narrow"
      rail={<LinksRail links={data.lesson_links} unitKey={unitKey} />}
    >
      <PageSheet>
        <h1 className="text-ink text-2xl font-semibold">
          {planHeading(unitKey)}
        </h1>
        <div className="mt-4 flex flex-col gap-4">
          {stale && dataAt ? <StaleBanner asOf={dataAt} thing="plan" /> : null}
          {data.state === "planning" ? (
            <Banner level="info" title={PLANNING_TEXT} />
          ) : null}
          {data.state === "failed" ? (
            <>
              <Banner level="blocking" title={FAILED_TEXT} />
              <Link href={`/units/${unitKey}/runs/${runId}`}>Open the run</Link>
            </>
          ) : null}
          {data.state === "stored" && data.entries.length === 0 ? (
            <p className="text-body text-ink">{EMPTY_TEXT}</p>
          ) : null}
          {data.state === "stored" && data.entries.length > 0 ? (
            <PlanList
              entries={data.entries}
              unitKey={unitKey}
              focusDay={focusDay}
            />
          ) : null}
        </div>
      </PageSheet>
    </TwoPane>
  );
}
