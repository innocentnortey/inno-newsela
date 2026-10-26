import { COPY } from "./copy";
import type { UnitMetrics } from "./data";

export function ContextLine({ northStar }: { northStar: UnitMetrics["north_star"] }) {
  const median = northStar.median_minutes === null ? null : `Median ${northStar.median_minutes} min`;
  const parts = [median, `n = ${northStar.n}`, northStar.segment_label || null].filter(
    (p): p is string => p !== null,
  );
  return (
    <p aria-label={COPY.contextLabel} className="text-body text-ink2 tabular-nums">
      {parts.join(" · ")}
    </p>
  );
}
