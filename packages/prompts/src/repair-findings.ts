import type { PromptFinding } from "./inputs.ts";

export const MATCHED_MAX_CHARS = 120;

/**
 * One finding as one line: `kind: message @ address | matched: "<json>" | code: X`.
 * The prefix `kind: message @ address` is the original format. The matched value is JSON-quoted so a
 * newline or quote inside it cannot start a fake finding line.
 */
export function format_finding_line(f: PromptFinding): string {
  let line = `${f.kind}: ${f.message}`;
  if (f.address !== null) line += ` @ ${f.address}`;
  if (f.matched !== undefined && f.matched !== "") {
    const m = f.matched.length > MATCHED_MAX_CHARS ? f.matched.slice(0, MATCHED_MAX_CHARS) + "…" : f.matched;
    line += ` | matched: ${JSON.stringify(m)}`;
  }
  if (f.code !== undefined && f.code !== "") line += ` | code: ${f.code}`;
  return line;
}

const LINE_RE = /^([a-z_]+): (.*?)(?: @ (\S+))?(?: \| matched: ("(?:[^"\\]|\\.)*"))?(?: \| code: (\S+))?$/;

/**
 * Inverse of `format_finding_line`. Because `data_block` neutralises the delimiter sequences after
 * formatting, a parsed matched value can differ from the original only in those sequences.
 */
export function parse_finding_line(line: string): PromptFinding | null {
  const m = LINE_RE.exec(line);
  if (m === null) return null;
  const out: PromptFinding = { kind: m[1]!, message: m[2]!, address: m[3] ?? null };
  if (m[4] !== undefined) out.matched = JSON.parse(m[4]) as string;
  if (m[5] !== undefined) out.code = m[5];
  return out;
}

/** Parses the text of a `repair_findings` data block (delimiter lines included). */
export function parse_repair_findings(block_text: string): PromptFinding[] {
  const out: PromptFinding[] = [];
  for (const line of block_text.split("\n")) {
    if (line.startsWith("<<<")) continue;
    const f = parse_finding_line(line);
    if (f !== null) out.push(f);
  }
  return out;
}
