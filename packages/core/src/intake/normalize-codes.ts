// Standards-code handling for the intake normaliser: tokenising, range expansion, prefix repair, resolution.

/** The standards seam NL-15's StandardsIndex satisfies structurally. */
export interface StandardResolution {
  input_code: string;
  status: "ok" | "malformed" | "unknown" | "parent";
  resolved: string[];
  suggestion: string | null;
  eld_label_mismatch: boolean;
}
export interface StandardsLookup {
  resolve(code: string, sheet_label?: string | null): StandardResolution;
}

/** A finding before the normaliser assigns its level, row and id. */
export interface RawFinding {
  kind: string;
  original_text: string;
  proposed_fix: string | null;
  default_choice: string | null;
}

export interface CodeResult {
  codes: string[];
  findings: RawFinding[];
}

const TOKEN = /(?:(RL|RI|RF|W|SL|L)\.)?(\d{1,2})\.(\d{1,2})(?:\.([a-z])(?:\s?[–-]\s?([a-z]))?)?/g;
const MSLS = /MSLS\s*\d+\.\d+[a-z]?/g;
const ELD_LINE = /^\W*(ELD\.P(?:I|II)\.\d+\.?\d*[a-z]?)\s*[–-]\s*(.+?)\s*$/;

function expand_letters(from: string, to: string): string[] {
  const out: string[] = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(String.fromCharCode(c));
  return out;
}

/** Codes in a focus / additional-supported cell. Bare numbers borrow the nearest preceding strand prefix. */
export function check_standards_cell(cell: string, standards: StandardsLookup): CodeResult {
  const findings: RawFinding[] = [];
  const codes: string[] = [];
  const seen_nonexistent = new Set<string>();
  const seen_parent = new Set<string>();
  let last_prefix: string | null = null;

  const consider = (code: string): void => {
    if (!codes.includes(code)) codes.push(code);
    const res = standards.resolve(code);
    if (res.status === "unknown" && !seen_nonexistent.has(code)) {
      seen_nonexistent.add(code);
      findings.push({ kind: "nonexistent_code", original_text: cell, proposed_fix: res.suggestion, default_choice: null });
    } else if (res.status === "parent" && !seen_parent.has(code)) {
      seen_parent.add(code);
      findings.push({
        kind: "parent_code",
        original_text: cell,
        proposed_fix: res.resolved.length > 0 ? res.resolved.join(", ") : null,
        default_choice: "keep_parent_code",
      });
    }
  };

  for (const chunk of cell.split(/[,\n]/)) {
    const shown: string[] = [];
    let bare = false;
    let unrepairable = false;
    for (const m of chunk.matchAll(TOKEN)) {
      const [, prefix, a, b, l1, l2] = m;
      let use = prefix ?? null;
      if (use) last_prefix = use;
      else {
        bare = true;
        use = last_prefix;
        if (!use) unrepairable = true;
      }
      const base = `${use ? use + "." : ""}${a}.${b}`;
      if (l1 && l2) {
        shown.push(`${base}.${l1}–${l2}`);
        for (const l of expand_letters(l1, l2)) consider(`${base}.${l}`);
      } else {
        shown.push(l1 ? `${base}.${l1}` : base);
        if (unrepairable && !prefix) {
          if (!codes.includes(base)) codes.push(base);
        } else consider(l1 ? `${base}.${l1}` : base);
      }
    }
    if (bare) {
      findings.push({
        kind: "malformed_code",
        original_text: cell,
        proposed_fix: unrepairable ? null : shown.join(", "),
        default_choice: null,
      });
    }
  }
  return { codes, findings };
}

/** ELD lines "ELD.PI.6.7 – label". The label goes to the lookup so it can flag a label/code mismatch. */
export function check_eld_cell(cell: string, standards: StandardsLookup): CodeResult {
  const findings: RawFinding[] = [];
  const codes: string[] = [];
  for (const line of cell.split("\n")) {
    const m = ELD_LINE.exec(line);
    if (!m) continue;
    const code = m[1] as string;
    const label = m[2] as string;
    if (!codes.includes(code)) codes.push(code);
    const res = standards.resolve(code, label);
    if (res.status === "unknown") {
      findings.push({ kind: "nonexistent_code", original_text: line, proposed_fix: res.suggestion, default_choice: null });
    } else if (res.eld_label_mismatch) {
      findings.push({ kind: "eld_mismatch", original_text: line, proposed_fix: res.suggestion, default_choice: "eld_keep" });
    }
  }
  return { codes, findings };
}

export function msls_codes(cell: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(MSLS)) if (!out.includes(m[0])) out.push(m[0]);
  return out;
}
