import type { components } from "@/lib/api-types";
import { formatNumber } from "./format";

type RunSummary = components["schemas"]["RunSummary"];

export function StatList({ summary }: { summary: RunSummary }) {
  const brakes =
    summary.brakes_fired.length === 0
      ? "None"
      : summary.brakes_fired.map((b) => `${b.brake} × ${b.count}`).join(", ");
  const rows: [string, string][] = [
    ["Placeholders left", formatNumber(summary.placeholders_left)],
    ["Calls lost in flight", formatNumber(summary.calls_lost_in_flight)],
    ["Brakes fired", brakes],
    ["Truncation retries", formatNumber(summary.truncation_retries)],
  ];
  return (
    <section aria-label="Other counts">
      <dl className="bg-panel border-hair shadow-e1 flex flex-col rounded-xl border">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="border-hair flex flex-wrap justify-between gap-2 border-b px-4 py-2 last:border-b-0"
          >
            <dt className="text-small text-ink2">{k}</dt>
            <dd className="text-small text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
