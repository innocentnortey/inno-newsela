import { Banner } from "@/components/ui/banner";
import { Link } from "@/components/ui/link";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { formatUsd, pausedSentence } from "./run-copy";

type RunProgress = components["schemas"]["RunProgress"];

export interface RunBannersProps {
  progress: RunProgress;
  unitKey: string;
  role: Role;
  callsLost: number;
}

export function RunBanners({
  progress,
  unitKey,
  role,
  callsLost,
}: RunBannersProps) {
  const total = progress.tiles.length;
  const count = (s: string) =>
    progress.counts_by_tile_state[s] ??
    progress.tiles.filter((t) => t.tile_state === s).length;
  const ready = count("ready");
  const failed = count("failed");
  const board = `/units/${unitKey}/board`;
  const scr5 = `${board}?start_run=unfinished_of_run&run_id=${progress.run_id}`;

  return (
    <>
      {progress.state === "partial" ? (
        <Banner
          level="advisory"
          title={`Run partial: ${failed} of ${total} failed. Ready lessons are reviewable.`}
        />
      ) : null}
      {progress.state === "capped" ? (
        <Banner
          level="advisory"
          title={`Run capped: the next call would pass the ${formatUsd(progress.cap_usd)} cap. No new calls start. To finish, start a new run on the unfinished rows.`}
        >
          {role === "author" ? (
            <Link href={scr5}>Start a new run on the unfinished rows</Link>
          ) : null}
        </Banner>
      ) : null}
      {progress.state === "paused" ? (
        <Banner level="advisory" title={pausedSentence(progress)} />
      ) : null}
      {progress.state === "cancelled" ? (
        <Banner
          level="info"
          title="Run cancelled. Calls in flight finished and were stored."
        />
      ) : null}
      {progress.state === "complete" ? (
        <Banner
          level="success"
          title={`Run complete: ${ready} of ${total} ready.`}
          action={
            <Link
              href={board}
              className="bg-primary text-on-primary inline-flex h-9 items-center rounded-md px-4 hover:no-underline"
            >
              Open the board
            </Link>
          }
        />
      ) : null}
      {callsLost > 0 ? (
        <Banner
          level="info"
          title={`The run resumed after a restart. ${callsLost} ${callsLost === 1 ? "call" : "calls"} lost in flight.`}
        />
      ) : null}
    </>
  );
}
