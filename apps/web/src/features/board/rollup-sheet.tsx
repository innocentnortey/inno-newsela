import { Glyph } from "@/components/ui/glyph";
import { STATUS_SPECS, type StatusKey, type Tone } from "@/components/ui/status";
import { ROLLUP_ORDER, stateLabel, type LessonState } from "./board-state";

const TONE_CLASS: Record<Tone, string> = {
  "neutral-ink2": "text-ink2",
  "neutral-ink3": "text-ink3",
  info: "text-primary",
  warn: "text-warn",
  success: "text-success",
  danger: "text-danger",
  plain: "text-ink",
};

const BAR_CLASS: Partial<Record<LessonState, string>> = {
  draft: "bg-ink3",
  in_review: "bg-primary",
  submitted: "bg-warn",
  approved: "bg-success",
  generation_failed: "bg-danger",
};

const EXTRA_STATES = ["changes_requested", "reopened", "exported"] as const;

function trackText(rollup: Record<string, number>): string {
  const parts: string[] = ROLLUP_ORDER.map((s) => `${stateLabel(s)} ${rollup[s] ?? 0}`);
  for (const s of EXTRA_STATES) if ((rollup[s] ?? 0) > 0) parts.push(`${stateLabel(s)} ${rollup[s]}`);
  return parts.join(", ");
}

export function RollupSheet({
  rollup,
  total,
  active,
  onSelect,
}: {
  rollup: Record<string, number>;
  total: number;
  active: LessonState | null;
  onSelect: (s: LessonState | null) => void;
}) {
  const barStates: LessonState[] = [...ROLLUP_ORDER, ...EXTRA_STATES];
  return (
    <section className="bg-panel border-hair flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-label text-ink2">{`Where the ${total} lessons are`}</h2>
      <div className="border-hair grid grid-cols-2 divide-x sm:grid-cols-5">
        {ROLLUP_ORDER.map((state) => {
          const spec = STATUS_SPECS[`lesson.${state}` as StatusKey];
          const isActive = active === state;
          return (
            <button
              key={state}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(isActive ? null : state)}
              className={`border-hair flex min-h-16 flex-col items-start gap-1 px-3 py-2 text-left ${isActive ? "bg-selected" : ""}`}
            >
              <span className={`text-small flex items-center gap-1 ${TONE_CLASS[spec.tone]}`}>
                <Glyph shape={spec.glyph} className="shrink-0" />
                <span className="text-ink2">{spec.label}</span>
              </span>
              <span className="text-title text-ink tabular-nums">{rollup[state] ?? 0}</span>
            </button>
          );
        })}
      </div>
      <div role="img" aria-label={trackText(rollup)} className="flex h-2 w-full overflow-hidden rounded-sm">
        {barStates.map((s) =>
          (rollup[s] ?? 0) > 0 ? (
            <span key={s} style={{ flexGrow: rollup[s] }} className={BAR_CLASS[s] ?? "bg-ink2"} />
          ) : null,
        )}
      </div>
    </section>
  );
}
