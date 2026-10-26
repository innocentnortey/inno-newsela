// NL-125: the trial record. One JSON line per assertion per trial; evals/src/suites/s5.ts reads them back (same shape as
// TrialLine in evals/src/suites/s5-support.ts). Ids and counts only: never a cookie, token, password or e-mail address.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface TrialLine {
  token: string;
  trial: number;
  passed: boolean;
  detail: unknown;
  ms: number;
  store_ms: number | null;
  request_ids: string[];
  store_id: string | null;
  error?: string;
}

export const TRIALS_FILE = resolve(__dirname, "../../test-results/integrity/trials.jsonl");
export const TRIALS = Number(process.env["INTEGRITY_TRIALS"] ?? "20");
export const FAULT = process.env["INTEGRITY_FAULT"] === "1";

export function appendTrial(line: TrialLine): void {
  mkdirSync(dirname(TRIALS_FILE), { recursive: true });
  appendFileSync(TRIALS_FILE, `${JSON.stringify(line)}\n`);
}
