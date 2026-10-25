import { useId } from "react";
import { Link } from "@/components/ui/link";
import { StatusPill } from "@/components/ui/status-pill";
import type { StatusKey } from "@/components/ui/status";
import type { components } from "@/lib/api-types";
import { progressText, routes } from "./format";

type Unit = components["schemas"]["Unit"];
type RunProgress = components["schemas"]["RunProgress"];

export function UnitCard({ unit, progress }: { unit: Unit; progress: RunProgress | "unavailable" | undefined }) {
  const id = useId();
  const r = routes(unit.unit_key);
  const latest = unit.versions[0];
  const run = unit.latest_run;
  return (
    <section
      aria-labelledby={id}
      className="bg-panel border-hair shadow-e1 flex flex-col gap-2 rounded-xl border p-(--space-4)"
    >
      <h2 id={id} className="text-title">
        <Link href={r.board}>{unit.title}</Link>
      </h2>
      {run ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={`run.${run.state}` as StatusKey} />
          <span className="text-body text-ink2">
            {progress && progress !== "unavailable" ? progressText(progress.counts_by_tile_state) : "Progress counts couldn't load."}
          </span>
          <Link href={r.run(run.run_id)}>View run progress</Link>
        </div>
      ) : latest ? (
        <Link href={r.report(latest.version_number)}>No run yet. Confirm the report, then generate.</Link>
      ) : null}
      {latest ? (
        <div className="flex flex-wrap gap-4">
          <Link href={r.board}>Open the board</Link>
          <Link href={r.report(latest.version_number)}>Validation report</Link>
        </div>
      ) : null}
    </section>
  );
}
