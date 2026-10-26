import { cn } from "@/lib/cn";
import { paramFromState, stateLabel, type LessonState } from "./board-state";

const ALWAYS: LessonState[] = ["draft", "in_review", "submitted", "approved", "generation_failed"];

export function StateFilter({
  value,
  counts,
  onChange,
}: {
  value: LessonState | null;
  counts: Record<string, number>;
  onChange: (s: LessonState | null) => void;
}) {
  const options: (LessonState | null)[] = [null, ...ALWAYS];
  if ((counts.changes_requested ?? 0) > 0 || value === "changes_requested") options.push("changes_requested");
  if ((counts.reopened ?? 0) > 0 || value === "reopened") options.push("reopened");
  return (
    // Look sheet M2: a segmented control (well track, the chosen segment raised on the panel). Native radios keep the
    // arrow-key behaviour and the names; each radio is a transparent layer over its segment, which carries the focus ring.
    <div role="radiogroup" aria-label="Filter lessons by state" className="bg-well inline-flex max-w-full flex-wrap gap-0.5 rounded-[9px] p-[3px]">
      {options.map((s) => {
        const on = value === s;
        return (
          <label
            key={s ?? "all"}
            className={cn(
              "text-small relative cursor-pointer rounded-[7px] px-3 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-focus)]",
              on ? "bg-panel text-ink shadow-e1 font-semibold" : "text-ink2 hover:text-ink font-medium",
            )}
          >
            <input
              type="radio"
              name="state-filter"
              value={paramFromState(s) ?? "all"}
              checked={on}
              onChange={() => onChange(s)}
              // Transparent and laid over the whole segment, so a click lands on the radio itself.
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-[7px] opacity-0"
            />
            {s ? (s === "generation_failed" ? "Failed" : stateLabel(s)) : "All"}
          </label>
        );
      })}
    </div>
  );
}
