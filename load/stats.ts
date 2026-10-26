// NL-118: pure statistics for the HTTP load probe (no clock, no I/O).
export interface Sample {
  t_ms: number;
  ms: number;
  ok: boolean;
}
export interface Window {
  start_s: number;
  p95_ms: number;
  n: number;
}

/** Nearest-rank percentile: sorted[ceil(p/100*n)-1]. An empty input is a caller bug, never NaN. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("percentile of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1]!;
}

export function error_rate(failed: number, total: number): number {
  return total === 0 ? 0 : failed / total;
}

/** p95 per fixed window over successful samples only; windows without a successful sample are left out. */
export function window_p95s(samples: Sample[], window_s: number): Window[] {
  const by = new Map<number, number[]>();
  for (const s of samples) {
    if (!s.ok) continue;
    const k = Math.floor(s.t_ms / 1000 / window_s);
    const list = by.get(k);
    if (list) list.push(s.ms);
    else by.set(k, [s.ms]);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => ({ start_s: k * window_s, p95_ms: percentile(v, 95), n: v.length }));
}

/** p95 of the successful samples in the first `first_s` seconds (the ramp, load <= ~25%); null under 5 samples. */
export function baseline_p95(samples: Sample[], first_s: number): number | null {
  const v = samples.filter((s) => s.ok && s.t_ms < first_s * 1000).map((s) => s.ms);
  return v.length < 5 ? null : percentile(v, 95);
}

/**
 * Seconds after `plateau_end_s` at which the first window starts from which this and every later window is
 * within `tol` of the baseline. 0 when already settled at plateau end; null when it never settles.
 */
export function recovery_s(
  windows: { start_s: number; p95_ms: number }[],
  baseline: number,
  plateau_end_s: number,
  tol = 0.1,
): number | null {
  const after = windows.filter((w) => w.start_s >= plateau_end_s).sort((a, b) => a.start_s - b.start_s);
  if (after.length === 0) return null;
  const limit = baseline * (1 + tol);
  let first = after.length;
  for (let i = after.length - 1; i >= 0 && after[i]!.p95_ms <= limit; i--) first = i;
  if (first === after.length) return null;
  return Math.max(0, after[first]!.start_s - plateau_end_s);
}
