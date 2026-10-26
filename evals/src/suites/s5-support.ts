// NL-125: support for the S5 integrity suite. The Playwright trial driver (apps/web/e2e/integrity) appends one JSON line
// per assertion per trial to TRIALS_FILE; s5.ts scores the repeat k of a case by reading trial k back. A missing line never passes.
import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { JsonValue } from "@ls/core/ports/common";

export const TOKENS = ["stale_approve", "zero_edits_after_lock", "no_silent_loss", "four_eyes", "suggestion_blocks", "round_trip"] as const;
export type Token = (typeof TOKENS)[number];

export const TRIALS_RELATIVE_PATH = "apps/web/test-results/integrity/trials.jsonl";

export interface TrialLine {
  token: string;
  trial: number;
  passed: boolean;
  detail: JsonValue;
  ms: number;
  /** Raw store latency of the trial's typing burst in ms (last keystroke to the new lesson_doc row); null when the trial measured none. */
  store_ms: number | null;
  /** Ids only (never a cookie, token, password or e-mail address). */
  request_ids: string[];
  store_id: string | null;
  error?: string;
}

export interface Availability {
  /** NL-116 (AI suggestions) is merged. */
  suggestion: boolean;
  /** NL-102 (export) is merged. */
  export: boolean;
}

export interface S5Deps {
  read_trials(): Promise<TrialLine[]>;
  available: Availability;
}

export function read_available(repo_root: string): Availability {
  const file = path.join(repo_root, "docs/plans/merged.txt");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const has = (id: string): boolean => new RegExp(`(^|[^A-Za-z0-9-])${id}([^0-9]|$)`, "m").test(text);
  return { suggestion: has("NL-116"), export: has("NL-102") };
}

export function make_read_trials(repo_root: string): () => Promise<TrialLine[]> {
  return async () => {
    const text = await fs.readFile(path.join(repo_root, TRIALS_RELATIVE_PATH), "utf8").catch(() => "");
    return text
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => JSON.parse(l) as TrialLine);
  };
}

/** Nearest-rank percentile over a list of numbers (p in 0..100). Null for an empty list. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] as number;
}

export const COLLAB_DEBOUNCE_MS = 500;
export const STORE_P95_TARGET_MS = 500;

export interface StoreP95 {
  n: number;
  raw: number | null;
  net: number | null;
  met: boolean | null;
}

/** Store p95 over every measured trial. The verdict uses the figure net of the 500 ms collab debounce (open item O-1); the raw figure is shown beside it. */
export function store_p95(lines: readonly TrialLine[]): StoreP95 {
  const raw = lines.map((l) => l.store_ms).filter((v): v is number => typeof v === "number");
  const p95 = percentile(raw, 95);
  if (p95 === null) return { n: 0, raw: null, net: null, met: null };
  const net = Math.max(0, p95 - COLLAB_DEBOUNCE_MS);
  return { n: raw.length, raw: p95, net, met: net <= STORE_P95_TARGET_MS };
}
