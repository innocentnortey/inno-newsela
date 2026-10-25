import { formatUsd } from "./run-copy";

export function CostMeter({
  spent,
  reserved,
  cap,
}: {
  spent: number;
  reserved: number;
  cap: number;
}) {
  const text = `${formatUsd(spent)} of ${formatUsd(cap)} cap`;
  const pct = cap > 0 ? Math.min(100, Math.max(0, (spent / cap) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body text-ink">{text}</p>
      <div
        role="meter"
        aria-label="Spend against the run cap"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={spent}
        aria-valuetext={text}
        className="bg-well h-2 w-full rounded-full"
      >
        <div
          className="bg-primary h-2 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      {reserved > 0 ? (
        <p className="text-small text-ink2">{`${formatUsd(reserved)} reserved for calls in flight`}</p>
      ) : null}
    </div>
  );
}
