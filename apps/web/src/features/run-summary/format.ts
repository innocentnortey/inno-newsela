import { unitIdFromKey } from "@/lib/keys";
import type { components } from "@/lib/api-types";

type RunState = components["schemas"]["RunState"];

// Nothing here rounds, converts units or derives a number: stored values are shown as stored (R-57).

/** Pads to at least 2 decimals; never drops a digit up to 6 places. */
export function formatUsd(n: number): string {
  const s = String(n);
  const dec = s.includes("e") ? 6 : (s.split(".")[1]?.length ?? 0);
  return "$" + n.toFixed(Math.max(2, Math.min(dec, 6)));
}

export function formatNumber(n: number): string {
  return String(n);
}

export function nText(n: number): string {
  return `n = ${n} ${n === 1 ? "lesson" : "lessons"}`;
}

export function unitLabel(unitKey: string): string {
  const id = unitIdFromKey(unitKey);
  const m = id && /^G(\d+)\.U(\d+)$/.exec(id);
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : unitKey;
}

export function isGoing(state: RunState): boolean {
  return state === "planning" || state === "running" || state === "paused";
}
