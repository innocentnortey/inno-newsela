import type { components } from "@/lib/api-types";
import { formatNumber, formatUsd, nText } from "./format";

type RunSummary = components["schemas"]["RunSummary"];

const CARD =
  "bg-panel border-hair shadow-e1 flex flex-col gap-1 rounded-xl border p-(--space-4)";
const FIGURE = "text-display text-ink tabular-nums";
const UNIT = "text-title-sm text-ink2";
const NLINE = "text-small text-ink3 tabular-nums";

export function StatCards({ summary }: { summary: RunSummary }) {
  const cost = summary.cost_per_ready_lesson_usd;
  const p95 = summary.p95_minutes_per_lesson;
  return (
    <dl
      aria-label="Run figures"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div className={CARD}>
        <dt className="text-label text-ink2">Wall time</dt>
        <dd className={FIGURE}>
          {formatNumber(summary.wall_time_seconds)}
          <span className={UNIT}> seconds</span>
        </dd>
        <dd className={NLINE}>{nText(summary.n)}</dd>
      </div>
      <div className={CARD}>
        <dt className="text-label text-ink2">Cost per lesson</dt>
        {cost === null ? (
          <dd className="text-title-sm text-ink2">No ready lessons yet</dd>
        ) : (
          <dd className={FIGURE}>{formatUsd(cost)}</dd>
        )}
        <dd className={NLINE}>
          {nText(summary.lessons.ready)} · ready lessons only · total{" "}
          {formatUsd(summary.cost_usd)}
        </dd>
      </div>
      <div className={CARD}>
        <dt className="text-label text-ink2">p95 minutes per lesson</dt>
        {p95 === null ? (
          <dd className="text-title-sm text-ink2">No figure yet</dd>
        ) : (
          <dd className={FIGURE}>
            {formatNumber(p95)}
            <span className={UNIT}> min</span>
          </dd>
        )}
        <dd className="text-small text-ink2">
          against the {summary.target_minutes_per_lesson}-minute target
        </dd>
        <dd className={NLINE}>{nText(summary.n)}</dd>
      </div>
      <div className={CARD}>
        <dt className="text-label text-ink2">Retries</dt>
        <dd className={FIGURE}>{formatNumber(summary.retries)}</dd>
        <dd className={NLINE}>{nText(summary.n)}</dd>
      </div>
    </dl>
  );
}
