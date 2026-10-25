// NL-49 AC-2: pure report rendering. No wall-clock time, so output is reproducible.
import type { JsonValue } from "@ls/core/ports/common";
import type { ProviderMode, SuiteName } from "./types.ts";

export const REPORT_KIND: Record<SuiteName, string> = {
  S1: "golden", S2: "golden", S3: "golden", S7: "golden", S4: "grounding", S5: "integrity", S6: "faults",
  S8: "heartbeat", S9: "full-run", S10: "seeded", S11: "heldout", S12: "judge-calibration", S13: "rating", S14: "load",
};

export function report_file_name(suite: SuiteName, git_sha: string): string {
  return `${REPORT_KIND[suite]}-${git_sha}.md`;
}

export interface SectionInput {
  suite: SuiteName;
  eval_run_id: string;
  git_sha: string;
  prompt_version: string | null;
  models: JsonValue;
  provider_mode: ProviderMode;
  n: number;
  repeat: number;
  passed: number;
  total: number;
  cost_usd: string;
  rows: { case_id: string; passed: boolean; source: string; failure_category: string | null }[];
}

export function render_suite_section(s: SectionInput): string {
  const lines = [
    `## Suite ${s.suite}`,
    `- eval_run_id: ${s.eval_run_id}`,
    `- git_sha: ${s.git_sha}`,
    `- prompt_version: ${s.prompt_version ?? "none (stub)"}`,
    `- models: ${JSON.stringify(s.models)}`,
    `- provider_mode: ${s.provider_mode}`,
    `- n: ${s.n}`,
    `- passed: ${s.passed}/${s.total}`,
    `- cost_usd: ${s.cost_usd}`,
    "",
    "| case_id | result | source | failure_category |",
    "|---|---|---|---|",
    ...s.rows.map((r) => `| ${r.case_id} | ${r.passed ? "pass" : "fail"} | ${r.source} | ${r.failure_category ?? ""} |`),
    "",
  ];
  return lines.join("\n");
}

const num = (suite: string): number => Number(suite.slice(1));

export function merge_section(existing: string | null, git_sha: string, kind: string, s: SectionInput): string {
  const sections = new Map<string, string>();
  if (existing !== null) {
    const parts = existing.split(/^## Suite (S\d+)$/m);
    for (let i = 1; i + 1 < parts.length; i += 2) {
      sections.set(parts[i] as string, `## Suite ${parts[i]}${(parts[i + 1] as string).replace(/\s+$/, "")}\n`);
    }
  }
  sections.set(s.suite, render_suite_section(s).replace(/\s+$/, "") + "\n");
  const body = [...sections.entries()].sort((a, b) => num(a[0]) - num(b[0])).map(([, v]) => v);
  return `# Eval report: ${kind} @ ${git_sha}\n\n${body.join("\n")}`;
}
