import { RadioCard } from "@/components/ui/choice";
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
    <div role="radiogroup" aria-label="Filter lessons by state" className="flex flex-wrap gap-2">
      {options.map((s) => (
        <RadioCard
          key={s ?? "all"}
          name="state-filter"
          value={paramFromState(s) ?? "all"}
          checked={value === s}
          onChange={() => onChange(s)}
          label={s ? (s === "generation_failed" ? "Failed" : stateLabel(s)) : "All"}
        />
      ))}
    </div>
  );
}
