"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { CantLoad, NotFound, StaleBanner } from "@/features/frame/conventions";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { useSession } from "@/features/frame/session-context";
import { isApiError } from "@/lib/api-client";
import { usePoll } from "@/lib/use-poll";
import { BoardSkeleton, RowsSkeleton } from "./board-skeleton";
import { paramFromState, runIsActive, stateFromParam, stateLabel, totalLessons, type LessonState } from "./board-state";
import { BoardTable } from "./board-table";
import { fetchBoard, fetchMetrics, fetchUnit } from "./data";
import { LinksRow } from "./links-row";
import { NorthStarTile } from "./north-star-tile";
import { RollupSheet } from "./rollup-sheet";
import { runHref, validationReportHref } from "./row-href";
import { StateFilter } from "./state-filter";
import { parseUnitTitle } from "./unit-title";
import { useBoardAnnouncements } from "./use-board-announcements";

export function BoardScreen({ unitKey }: { unitKey: string }) {
  const { role } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = stateFromParam(params.get("state"));

  const board = usePoll(() => fetchBoard(unitKey, filter), { intervalMs: 2000 });
  const metrics = usePoll(() => fetchMetrics(unitKey), { intervalMs: 10000 });
  const unit = usePoll(() => fetchUnit(unitKey), { intervalMs: 5000 });

  const { grade, unit: unitLabel, novel } = parseUnitTitle(unit.data?.title, unitKey);
  useSetBreadcrumb([
    { label: "Units", href: "/units" },
    ...(grade ? [{ label: grade }] : []),
    { label: unitLabel },
  ]);

  const shown = board.data && board.data.filter === filter ? board.data.board : undefined;
  const rollup = board.data?.board.rollup;
  const total = rollup ? totalLessons(rollup) : 0;
  const run = unit.data?.latest_run ?? null;
  const runId = run?.run_id ?? null;
  const totalPlanned = metrics.data?.north_star.approved.total;

  useBoardAnnouncements({
    filter: board.data?.filter ?? null,
    rows: board.data && board.data.filter === null ? board.data.board.rows : undefined,
    runState: run?.state,
  });

  function setFilter(s: LessonState | null) {
    const p = paramFromState(s);
    router.replace(p ? `${pathname}?state=${p}` : pathname, { scroll: false });
    board.retry();
  }

  if (isApiError(board.error) && board.error.code === "NOT_FOUND" && !board.data) {
    return <NotFound what={`unit "${unitKey}"`} where="Lesson Studio" boardHref="/units" />;
  }

  const header = (
    <PageHeader
      eyebrow="Unit board"
      title={
        <>
          {unitLabel}
          {novel ? (
            <>
              {" · "}
              <em>{novel}</em>
            </>
          ) : null}
        </>
      }
      meta={total > 0 ? <span className="bg-well rounded-sm px-2 py-0.5 text-label">{`${total} lessons`}</span> : undefined}
    />
  );
  const stale = board.stale && board.dataAt ? <StaleBanner asOf={board.dataAt} thing="board" /> : null;

  if (board.error && !board.data) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        {stale}
        <CantLoad thing="the unit board" onRetry={board.retry} />
      </div>
    );
  }
  if (!board.data || !rollup) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        {stale}
        <BoardSkeleton />
      </div>
    );
  }

  const active = runIsActive(run?.state) && runId;
  const runBanner = active ? (
    <Banner
      level="info"
      title={`Run in progress: ${total}${totalPlanned !== undefined ? ` of ${totalPlanned}` : ""} lessons ready.`}
      action={<Link href={runHref(unitKey, runId)}>Watch progress</Link>}
    />
  ) : null;

  if (total === 0) {
    const latestVersion = unit.data?.versions.reduce((m, v) => Math.max(m, v.version_number), 0);
    return (
      <div className="flex flex-col gap-4">
        {header}
        {stale}
        {runBanner}
        <div className="flex flex-col gap-2">
          <p className="text-title-sm">No lessons generated for this unit yet.</p>
          <p className="text-small text-ink2">Lessons appear here as a run drafts them.</p>
          {role === "author" ? (
            latestVersion ? <Link href={validationReportHref(unitKey, latestVersion)}>Go to the validation report</Link> : null
          ) : runId ? (
            <Link href={runHref(unitKey, runId)}>See the latest run</Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {stale}
      {runBanner}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <RollupSheet rollup={rollup} total={total} active={filter} onSelect={setFilter} />
        <NorthStarTile metrics={metrics.data} error={Boolean(metrics.error)} onRetry={metrics.retry} />
      </div>
      <LinksRow unitKey={unitKey} runId={runId} />
      <section className="bg-panel border-hair rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <StateFilter value={filter} counts={rollup} onChange={setFilter} />
          <p className="text-small text-ink2">Sorted by blocking issues</p>
        </div>
        {!shown ? (
          <RowsSkeleton />
        ) : shown.rows.length === 0 && filter ? (
          <div className="flex flex-col items-start gap-2">
            <p>{`No lessons are ${stateLabel(filter)}.`}</p>
            <Button variant="secondary" onClick={() => setFilter(null)}>
              Show all lessons
            </Button>
          </div>
        ) : (
          <BoardTable rows={shown.rows} unitKey={unitKey} role={role} runId={runId} />
        )}
      </section>
    </div>
  );
}
