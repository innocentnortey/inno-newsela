import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UnitMetrics } from "./data";

const TITLE = "Reviewer minutes per approved lesson";

export function NorthStarTile({
  metrics,
  error,
  onRetry,
}: {
  metrics: UnitMetrics | undefined;
  error: boolean;
  onRetry: () => void;
}) {
  if (!metrics) {
    if (!error) return <div data-skeleton="tile" className="bg-well h-48 rounded-xl" />;
    return (
      <Card title={TITLE}>
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-body">
            Couldn&apos;t load the north-star numbers.
          </p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }
  const ns = metrics.north_star;
  const empty = ns.n === 0 || ns.median_minutes === null;
  return (
    <Card title={TITLE}>
      <div className="flex flex-col gap-2">
        {empty ? (
          <p className="text-title-sm text-ink2">No approved lessons yet</p>
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="text-display text-ink tabular-nums">{ns.median_minutes}</span>
            <span className="text-title-sm text-ink2">min</span>
            <span className="text-small text-ink2 ml-auto">{`median · n = ${ns.n}`}</span>
          </p>
        )}
        {ns.segment_label ? <p className="text-small text-ink2">{ns.segment_label}</p> : null}
        <ul className="flex flex-wrap gap-2">
          {ns.fast_approvals.of > 0 ? (
            <li className="bg-well text-small rounded-md p-2">{`fast approvals ${ns.fast_approvals.count} of ${ns.fast_approvals.of}`}</li>
          ) : null}
          <li className="bg-well text-small rounded-md p-2">{`approved ${ns.approved.k} of ${ns.approved.total}`}</li>
        </ul>
        <p className="text-small text-ink3">{ns.caption}</p>
      </div>
    </Card>
  );
}
