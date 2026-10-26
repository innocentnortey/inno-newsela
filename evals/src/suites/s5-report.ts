// NL-125 (WF-43): the extra lines the S5 report carries beyond the runner's table: the three contexts, n per assertion,
// models and prompt version, the store p95 verdict, the failing trials by number and the "not built" rows.
import { COLLAB_DEBOUNCE_MS, STORE_P95_TARGET_MS, TOKENS, store_p95, type Availability, type TrialLine } from "./s5-support.ts";

export interface NotesInput {
  lines: readonly TrialLine[];
  git_sha: string;
  available: Availability;
  /** The assertions this run covered (a `--grep` run covers one). */
  tokens?: readonly string[];
}

export function integrity_notes(i: NotesInput): string {
  const covered = TOKENS.filter((t) => (i.tokens === undefined || i.tokens.includes(t)) && (t !== "suggestion_blocks" || i.available.suggestion));
  const per = covered.map((t) => {
    const mine = i.lines.filter((l) => l.token === t);
    return `${t} ${mine.filter((l) => l.passed).length}/${mine.length}`;
  });
  const p = store_p95(i.lines);
  const failing = i.lines.filter((l) => !l.passed).sort((a, b) => a.token.localeCompare(b.token) || a.trial - b.trial);
  const out = [
    "### Integrity run notes",
    "",
    `- contexts per trial: A reviewer editing, B second reviewer co-editing, C approver (three live browser contexts, real collaboration process, stub provider)`,
    `- git_sha: ${i.git_sha}`,
    `- model IDs: stub (no provider call)`,
    `- prompt version: none (stub)`,
    `- n (trials per assertion): ${per.join(", ") || "none"}`,
    p.raw === null
      ? `- Store p95: not measured (no trial recorded a store latency)`
      : `- Store p95: ${p.raw} ms raw, ${p.net} ms net of the ${COLLAB_DEBOUNCE_MS} ms collab debounce (n=${p.n}); target <= ${STORE_P95_TARGET_MS} ms [A] -> SP-2: ${p.met ? "MET" : "MISSED"}`,
    failing.length === 0
      ? `- failing trials: none`
      : `- failing trials: ${failing.map((l) => `${l.token} trial ${l.trial}`).join("; ")}`,
  ];
  for (const l of failing) out.push(`  - ${l.token} trial ${l.trial}: ${typeof l.detail === "string" ? l.detail : JSON.stringify(l.detail)}`.slice(0, 600));
  if (!i.available.suggestion) out.push("- suggestion_blocks: not built (cut #8), counted neither pass nor fail");
  if (!i.available.export) out.push("- export hash: not built (NL-102), counted neither pass nor fail");
  return out.join("\n");
}

/** Put the notes inside the S5 section (after its table), replacing notes from an earlier run. */
export function add_notes(report: string, notes: string): string {
  const start = report.indexOf("## Suite S5");
  if (start < 0) return `${report.replace(/\s+$/, "")}\n\n${notes}\n`;
  const rest = report.slice(start + 1);
  const next = rest.search(/^## Suite S\d+$/m);
  const end = next < 0 ? report.length : start + 1 + next;
  let section = report.slice(start, end).replace(/\s+$/, "");
  const old = section.indexOf("### Integrity run notes");
  if (old >= 0) section = section.slice(0, old).replace(/\s+$/, "");
  return `${report.slice(0, start)}${section}\n\n${notes}\n${end < report.length ? `\n${report.slice(end)}` : ""}`;
}
