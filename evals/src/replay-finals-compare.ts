// Compares replay outputs taken at consecutive commit boundaries (F4-6): pass rates with both denominators, per-kind
// blocking-lesson counts with deltas, and which lessons changed gate verdict between two boundaries.
import { readFileSync } from "node:fs";
import { delta, rate_text, type KindCounts, type ReplayRecord, type Summary, type Which } from "./replay-finals.ts";

export interface Boundary { label: string; commit: string; code_dirty: boolean; input_hash: string; review_context: string; summaries: Record<string, Summary>; records: ReplayRecord[] }
type Gate = "gen" | "review";

export function load_boundary(path: string): Boundary {
  const j = JSON.parse(readFileSync(path, "utf8")) as { provenance?: { analysis?: string; label?: string; code?: { commit: string; dirty_files: unknown[] }; input_hash?: string; review_context?: string }; summaries?: Record<string, Summary>; records?: ReplayRecord[] };
  const p = j.provenance;
  if (p?.analysis !== "current-code reanalysis" || p.code === undefined || j.summaries === undefined || j.records === undefined) throw new Error(`not a replay-finals output: ${path}`);
  return { label: p.label ?? "", commit: p.code.commit, code_dirty: p.code.dirty_files.length > 0, input_hash: p.input_hash ?? "", review_context: p.review_context ?? "", summaries: j.summaries, records: j.records };
}

const passes = (r: ReplayRecord | undefined, gate: Gate): boolean => {
  const fs = r === undefined ? null : r[gate];
  return fs !== null && !fs.some((f) => f.level === "blocking");
};

/** A lesson passes a gate when it compiled and raised no blocking finding; a lesson that did not compile does not pass. */
export function transitions(prev: readonly ReplayRecord[], next: readonly ReplayRecord[], gate: Gate): { newly_blocked: string[]; newly_unblocked: string[]; still_blocked: number; still_passing: number } {
  const p = new Map(prev.map((r) => [r.lesson, r])), n = new Map(next.map((r) => [r.lesson, r]));
  const out = { newly_blocked: [] as string[], newly_unblocked: [] as string[], still_blocked: 0, still_passing: 0 };
  for (const lesson of [...new Set([...p.keys(), ...n.keys()])].sort()) {
    const a = passes(p.get(lesson), gate), b = passes(n.get(lesson), gate);
    if (a && !b) out.newly_blocked.push(lesson);
    else if (!a && b) out.newly_unblocked.push(lesson);
    else if (a) out.still_passing += 1;
    else out.still_blocked += 1;
  }
  return out;
}

const short = (c: string): string => c.slice(0, 7);
const ORDER = "Attribution is order-dependent: slice D's commits sit on top of slice A's, so there is no D-without-A run; each step shows what that commit changed on top of the previous one.";

export function render_comparison(bs: readonly Boundary[], which: Which): string {
  const L: string[] = [];
  const sum = (b: Boundary): Summary => {
    const s = b.summaries[which];
    if (s === undefined) throw new Error(`${b.label}: no summary for ${which}`);
    return s;
  };
  const recs = (b: Boundary): ReplayRecord[] => b.records.filter((r) => r.which === which);
  L.push(`# Replay comparison: \`${which}\` outputs (current-code reanalysis)`, "");
  L.push("| # | label | commit | dirty code files? | input_hash | review context |", "|---|---|---|---|---|---|");
  bs.forEach((b, i) => L.push(`| ${i} | ${b.label} | ${short(b.commit)} | ${b.code_dirty ? "yes" : "no"} | ${b.input_hash.slice(0, 12)} | ${b.review_context} |`));
  L.push("");
  if (new Set(bs.map((b) => b.input_hash)).size > 1) L.push("**WARNING: the input_hash values differ, so these boundaries did not replay the same stored inputs.**", "");
  for (const gate of ["gen", "review"] as const) {
    L.push(`## ${gate === "gen" ? "Generation" : "Review"} gate: lessons passing`, "", "| # | commit | passing (of all, of compiled) | not compiled |", "|---|---|---|---|");
    bs.forEach((b, i) => { const s = sum(b); L.push(`| ${i} | ${short(b.commit)} | ${rate_text(gate === "gen" ? s.gen_pass : s.review_pass, s)} | ${s.not_compiled} |`); });
    L.push("");
    const key = gate === "gen" ? "gen_blocking" : "review_blocking";
    const kinds = [...new Set(bs.flatMap((b) => Object.keys(sum(b)[key])))].sort();
    const head = ["kind", ...bs.map((_, i) => `#${i}`), ...bs.slice(1).map((_, i) => `d ${i}->${i + 1}`)];
    L.push(`### Lessons with a blocking ${gate} finding, by kind`, "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`);
    const deltas = bs.slice(1).map((b, i) => delta(sum(bs[i]!)[key] as KindCounts, sum(b)[key] as KindCounts));
    for (const k of kinds) {
      const cells = bs.map((b) => String(sum(b)[key][k]?.lessons ?? 0));
      const ds = deltas.map((d) => (d[k] === undefined ? "" : d[k]! > 0 ? `+${d[k]}` : String(d[k])));
      L.push(`| ${k} | ${[...cells, ...ds].join(" | ")} |`);
    }
    L.push("");
    L.push(`### Lessons changing ${gate} verdict between consecutive boundaries`, "");
    for (let i = 1; i < bs.length; i++) {
      const t = transitions(recs(bs[i - 1]!), recs(bs[i]!), gate);
      L.push(`- ${i - 1}->${i} (${short(bs[i - 1]!.commit)} -> ${short(bs[i]!.commit)}, ${bs[i]!.label}): newly blocked ${t.newly_blocked.length}${t.newly_blocked.length ? ` (${t.newly_blocked.join(", ")})` : ""}; newly unblocked ${t.newly_unblocked.length}${t.newly_unblocked.length ? ` (${t.newly_unblocked.join(", ")})` : ""}; still blocked ${t.still_blocked}; still passing ${t.still_passing}`);
    }
    L.push("");
  }
  L.push(ORDER, "");
  return L.join("\n");
}
