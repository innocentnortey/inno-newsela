"use client";

import { Banner } from "@/components/ui/banner";
import { Link } from "@/components/ui/link";
import { PageHeader } from "@/components/layout/page-header";
import { CantLoad, NotFound, StaleBanner } from "@/features/frame/conventions";
import { FailuresTable } from "./failures-table";
import { isGoing, unitLabel } from "./format";
import { StatCards } from "./stat-cards";
import { StatList } from "./stat-list";
import { useRunSummary } from "./use-run-summary";

export function RunSummaryScreen({
  unitKey,
  runId,
}: {
  unitKey: string;
  runId: string;
}) {
  const poll = useRunSummary(runId);
  const board = `/units/${unitKey}/board`;
  const { data } = poll;

  if (poll.notFound)
    return <NotFound what="run" boardHref={board} where={unitLabel(unitKey)} />;
  if (!data && !poll.error)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading run summary</span>
        <div
          aria-hidden
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-well h-28 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (!data) return <CantLoad thing="run summary" onRetry={poll.retry} />;

  return (
    <>
      <PageHeader
        eyebrow="Run"
        title="Run summary"
        meta={
          <>
            {unitLabel(unitKey)} · {runId}
          </>
        }
      />
      <div className="flex flex-col gap-4">
        {poll.stale && poll.dataAt ? (
          <StaleBanner asOf={poll.dataAt} thing="run summary" />
        ) : null}
        {isGoing(data.state) ? (
          <Banner
            level="info"
            title="This run is still going. Numbers so far:"
          />
        ) : null}
        <StatCards summary={data} />
        <FailuresTable rows={data.failures_by_reason} />
        <StatList summary={data} />
        {data.report_path ? (
          <p className="text-small">
            <Link href={data.report_path} external>
              Full-run report (file)
            </Link>
          </p>
        ) : (
          <p className="text-small text-ink2">
            Full-run report (file): not written yet
          </p>
        )}
        <nav aria-label="Run links" className="flex gap-4 text-small">
          <Link href={`/units/${unitKey}/runs/${runId}`}>Run progress</Link>
          <Link href={board}>Back to the board</Link>
        </nav>
      </div>
    </>
  );
}
