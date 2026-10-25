"use client";

import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Link } from "@/components/ui/link";
import { StatusPill } from "@/components/ui/status-pill";
import type { StatusKey } from "@/components/ui/status";
import { PageHeader } from "@/components/layout/page-header";
import {
  CantLoad,
  ForbiddenBanner,
  NotFound,
  StaleBanner,
} from "@/features/frame/conventions";
import { useSession } from "@/features/frame/session-context";
import type { components } from "@/lib/api-types";
import { useRateLimitedAnnounce, describeChanges } from "./announcements";
import { ControlBar, type ControlError } from "./control-bar";
import { CostMeter } from "./cost-meter";
import { RunBanners } from "./run-banners";
import { unitLabel } from "./run-copy";
import { TileGrid, TileSkeleton } from "./tile-grid";
import { useCallsLost } from "./use-calls-lost";
import { useRunProgress } from "./use-run-progress";

type RunProgress = components["schemas"]["RunProgress"];

export function ProgressScreen({
  unitKey,
  runId,
}: {
  unitKey: string;
  runId: string;
}) {
  const { role } = useSession();
  const poll = useRunProgress(runId);
  const { data, dataAt, stale, error, notFound, retry } = poll;
  const callsLost = useCallsLost(runId, data?.state);
  const say = useRateLimitedAnnounce();
  const prev = useRef<RunProgress | undefined>(undefined);
  const [controlError, setControlError] = useState<ControlError | null>(null);

  useEffect(() => {
    if (!data) return;
    say(describeChanges(prev.current, data));
    prev.current = data;
  }, [data, say]);

  const board = `/units/${unitKey}/board`;
  if (notFound)
    return <NotFound what="run" boardHref={board} where={unitLabel(unitKey)} />;
  if (!data) {
    if (error) return <CantLoad thing="run progress" onRetry={retry} />;
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading run progress</span>
        <TileSkeleton />
      </div>
    );
  }

  const total = data.tiles.length;
  const ready =
    data.counts_by_tile_state.ready ??
    data.tiles.filter((t) => t.tile_state === "ready").length;
  const hhmm = new Date(data.updated_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const runBase = `/units/${unitKey}/runs/${runId}`;

  return (
    <div>
      <PageHeader
        eyebrow="Run"
        title={`${unitLabel(unitKey)} · ${total} lessons`}
        meta={
          <>
            <StatusPill status={`run.${data.state}` as StatusKey} />{" "}
            <span>Updated {hhmm}</span> · <span>{runId}</span>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        {stale && dataAt ? <StaleBanner asOf={dataAt} thing="run" /> : null}
        {controlError?.kind === "forbidden" ? (
          <ForbiddenBanner message={controlError.message} />
        ) : null}
        {controlError?.kind === "failed" ? (
          <Banner level="blocking" title={controlError.text} />
        ) : null}
        <RunBanners
          progress={data}
          unitKey={unitKey}
          role={role}
          callsLost={callsLost}
        />
        <section
          aria-label="Run summary"
          className="bg-panel border-hair flex flex-col gap-3 rounded-xl border p-4"
        >
          <p className="text-title-sm text-ink">{`${ready} of ${total} ready`}</p>
          <CostMeter
            spent={data.spent_usd}
            reserved={data.reserved_usd}
            cap={data.cap_usd}
          />
          <ControlBar
            runId={runId}
            state={data.state}
            role={role}
            onChanged={retry}
            onError={setControlError}
          />
          <nav aria-label="Run links" className="flex gap-4">
            <Link href={`${runBase}/plan`}>Unit plan</Link>
            <Link href={`${runBase}/summary`}>Run summary</Link>
          </nav>
        </section>
        <TileGrid tiles={data.tiles} unitKey={unitKey} />
      </div>
    </div>
  );
}
