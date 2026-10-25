import type { CheckKind } from "./state.ts";

/** Documented default (settings `circuit_breaker_same_check`); callers pass the real threshold. */
export const CIRCUIT_BREAKER_SAME_CHECK = 3;

export interface TerminalJobView {
  lesson_id: string;
  status: "queued" | "running" | "ready" | "generation_failed" | "cancelled";
  first_failing_kind: CheckKind | null;
  /** epoch ms */
  finished_at: number;
}

export interface PauseDecision {
  pause: boolean;
  check: CheckKind | null;
  lesson_ids: string[];
}

export function should_pause_run(
  recent: readonly TerminalJobView[],
  threshold: number,
): PauseDecision {
  const none: PauseDecision = { pause: false, check: null, lesson_ids: [] };
  if (threshold < 1) return none;
  const last = recent
    .filter((j) => j.status === "ready" || j.status === "generation_failed")
    .sort((a, b) =>
      b.finished_at !== a.finished_at
        ? b.finished_at - a.finished_at
        : a.lesson_id < b.lesson_id
          ? -1
          : a.lesson_id > b.lesson_id
            ? 1
            : 0,
    )
    .slice(0, threshold);
  if (last.length < threshold) return none;
  const kind = last[0]?.first_failing_kind ?? null;
  if (kind === null) return none;
  if (
    !last.every(
      (j) => j.status === "generation_failed" && j.first_failing_kind === kind,
    )
  ) {
    return none;
  }
  return { pause: true, check: kind, lesson_ids: last.map((j) => j.lesson_id) };
}
