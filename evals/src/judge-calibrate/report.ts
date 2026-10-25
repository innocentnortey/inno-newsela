// NL-111: pure report rendering and the reporting gate. Holdout labels never reach any function here that tunes anything.
import fs from "node:fs";
import path from "node:path";

export interface Agreement { agreed: number; n: number }

const frac = (a: Agreement): string => (a.n === 0 ? "n/a" : (a.agreed / a.n).toFixed(2));
// agreed/n >= 0.8 in integers, so 16/20 is exactly on the line
const at_least_80 = (a: Agreement): boolean => a.agreed * 5 >= a.n * 4;

/** yes only when dev >= 0.8 on >= 20 labels AND the holdout (>= 10 labels) is also >= 0.8 (R-23). */
export function gate(dev: Agreement, holdout: Agreement | null): boolean {
  if (dev.n < 20 || !at_least_80(dev)) return false;
  return holdout !== null && holdout.n >= 10 && at_least_80(holdout);
}

export interface ReportHeader {
  git_sha: string;
  judge_model: string;
  rubric_version: string;
  provider_mode: "real" | "stub";
}

function head(h: ReportHeader): string[] {
  return [
    "# Judge calibration (S12, WF-31)",
    "",
    `- git SHA: ${h.git_sha}`,
    `- judge model: ${h.judge_model}`,
    `- rubric version: ${h.rubric_version}`,
    `- provider mode: ${h.provider_mode}${h.provider_mode === "stub" ? " (provider stub: not a calibration)" : ""}`,
    "",
  ];
}

const dev_lines = (dev: Agreement): string[] => [`- dev agreement: ${frac(dev)} (${dev.agreed}/${dev.n}), n=${dev.n}`];

function write(file: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join("\n") + "\n");
}

export type WriteFile = (file: string, lines: string[]) => void;
export const write_report_file: WriteFile = write;

/** Dev numbers first; the holdout is still pending. */
export function dev_section(h: ReportHeader, dev: Agreement): string[] {
  return [...head(h), ...dev_lines(dev), "- holdout: pending", "", "judge verdicts may be reported: no", ""];
}

export function final_report(h: ReportHeader, dev: Agreement, holdout: Agreement, provider_errors: number): string[] {
  const ok = h.provider_mode === "real" && gate(dev, holdout);
  return [
    ...head(h), ...dev_lines(dev),
    `- holdout agreement: ${frac(holdout)} (${holdout.agreed}/${holdout.n}), n=${holdout.n}`,
    `- provider errors (counted as disagreement): ${provider_errors}`,
    `- n total: ${dev.n + holdout.n}`,
    "",
    "The judge is advisory (CON-13) and never gates Approve.",
    "",
    `judge verdicts may be reported: ${ok ? "yes" : "no"}`,
    "",
  ];
}
