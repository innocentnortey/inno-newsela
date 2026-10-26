// NL-109 (S3): the `## Detail S3` block of evals/reports/drafts-<sha>.md. Pure and reproducible (no wall clock).
// Ids, counts, FC ids, model ids and costs only: never block text, prompt text or cell text (AC-7).
import type { AssertionResult, Trajectory } from "./s3-assertions.ts";

export interface S3Actual {
  pair: string;
  assertions: AssertionResult[];
  trajectory: Trajectory;
  counts: { placeholders: number; minutes_total: number | null; sections: number };
  schema_valid_first_pass: boolean | null;
  repairs_used: number;
  tokens: { input: number; output: number };
  served_models: string[];
  requested_models: string[];
  cost_usd: string;
  [k: string]: unknown;
}
export interface Sp1Baseline {
  mean_usd_per_lesson: { value: number };
  rows: Record<string, { sheet_row: number; wall_s: number; cost_usd: number; words: number; schema_valid: string; required_blocks: string }>;
}
export interface S3ReportInput {
  git_sha: string;
  prompt_version: string | null;
  provider_mode: "real" | "stub";
  repeat: number;
  cost_total: string;
  guard_line: string | null;
  effort: string;
  max_tokens: string;
  history: { case_id: string; repeat: number; actual: S3Actual }[];
  sp1: Sp1Baseline | null;
}

const uniq = (xs: string[]): string[] => [...new Set(xs)].sort();
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s.length === 0 ? 0 : (s[Math.floor((s.length - 1) / 2)] as number); };

export function render_drafts_report(r: S3ReportInput): string {
  const all = r.history;
  const served = uniq(all.flatMap((h) => h.actual.served_models));
  const requested = uniq(all.flatMap((h) => h.actual.requested_models));
  const first_ok = all.filter((h) => h.actual.schema_valid_first_pass === true).length;
  const repairs = all.reduce((a, h) => a + h.actual.repairs_used, 0);
  const case_ids = uniq(all.map((h) => h.case_id));
  const lines = [
    "## Detail S3",
    `- git_sha: ${r.git_sha}`,
    `- prompt_version: ${r.prompt_version ?? "none (stub)"}`,
    `- served_models: [${served.join(", ")}]`,
    `- requested_models: [${requested.join(", ")}]`,
    `- effort: ${r.effort}`,
    `- max_tokens: ${r.max_tokens}`,
    `- n: ${all.length} (${case_ids.length} cases x ${r.repeat} repeats)`,
    `- provider_mode: ${r.provider_mode}${r.provider_mode === "stub" ? " (no model was called)" : ""}`,
    `- cost_total_usd: ${r.cost_total}${r.guard_line === null ? "" : `   (${r.guard_line})`}`,
    `- M-31 first-pass schema-valid: ${first_ok}/${all.length} (repairs used: ${repairs} of ${all.length})`,
    "",
  ];
  for (const id of case_ids) {
    const rows = all.filter((h) => h.case_id === id).sort((a, b) => a.repeat - b.repeat);
    lines.push(`### ${id} (${rows[0]?.actual.pair ?? ""})`, "");
    lines.push(`| assertion | ${rows.map((x) => `repeat ${x.repeat}`).join(" | ")} | FC |`, `|---|${rows.map(() => "---|").join("")}---|`);
    const names = rows[0]?.actual.assertions.map((a) => a.name) ?? [];
    for (const name of names) {
      const cells = rows.map((x) => (x.actual.assertions.find((a) => a.name === name)?.passed ? "pass" : "fail"));
      const fc = rows.map((x) => x.actual.assertions.find((a) => a.name === name && !a.passed)?.fc).find((f) => f != null) ?? "";
      lines.push(`| ${name} | ${cells.join(" | ")} | ${fc} |`);
    }
    const passes = rows.filter((x) => x.actual.assertions.every((a) => a.passed)).length;
    const tok = rows.map((x) => x.actual.tokens.output);
    lines.push("",
      `passes: ${passes}/${rows.length}, minutes_total [${rows.map((x) => x.actual.counts.minutes_total ?? "none").join(", ")}], placeholders [${rows.map((x) => x.actual.counts.placeholders).join(", ")}], output tokens [${Math.min(...tok)}..${Math.max(...tok)}]`,
      `cost_usd: ${rows.reduce((a, x) => a + Number(x.actual.cost_usd), 0).toFixed(6)}`);
    for (const x of rows) {
      const t = x.actual.trajectory;
      const failed = x.actual.assertions.filter((a) => !a.passed);
      if (failed.length === 0 && !t.repair_recovered) continue;
      lines.push(`- repeat ${x.repeat}: first_failing_step: ${t.first_failing_step ?? "none"}${t.fc === null ? "" : `, ${t.fc}`}${t.repair_recovered ? " (repair recovered)" : ""}${failed.map((a) => `; ${a.name} ${a.fc ?? ""}: ${a.detail}`).join("")}`);
    }
    lines.push("");
  }
  lines.push("### Compared with SP-1", "");
  if (r.sp1 === null) lines.push("SP-1 per-row figures: see the SP-1 record (docs/analysis/spikes/SP-1-one-call-draft.md).");
  else {
    lines.push("| case | SP-1 row | SP-1 cost | SP-1 wall s | SP-1 words | SP-1 schema valid | this run cost (median) | this run output tokens (median) |", "|---|---|---|---|---|---|---|---|");
    for (const id of case_ids) {
      const b = r.sp1.rows[id];
      const rows = all.filter((h) => h.case_id === id);
      const cost = median(rows.map((x) => Number(x.actual.cost_usd)));
      const tok = median(rows.map((x) => x.actual.tokens.output));
      lines.push(b === undefined ? `| ${id} | none | | | | | ${cost.toFixed(4)} | ${tok} |` : `| ${id} | ${b.sheet_row} | $${b.cost_usd} | ${b.wall_s} | ${b.words} | ${b.schema_valid} | $${cost.toFixed(4)} | ${tok} |`);
    }
    lines.push("", `SP-1 mean per lesson including repairs: $${r.sp1.mean_usd_per_lesson.value}.`);
  }
  lines.push("");
  return lines.join("\n");
}
