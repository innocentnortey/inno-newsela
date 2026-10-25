import { join } from "node:path";
// CDE standards index (NL-15, DO-4 section 8). Pure lookup over seeded official text (GR-5):
// text and strands come only from the seed rows, never from a sheet label.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type StandardSet = "CA_CCSS_ELA_6" | "CA_ELD_6" | "MSLS_6";

/** Same shape as the `standard` table columns (packages/db/migrations/0002_intake.sql). */
export interface StandardRow {
  code: string;
  set: StandardSet;
  text: string;
  parent_code: string | null;
  is_leaf: boolean;
  eld_strand: string | null;
}

export type StandardStatus = "ok" | "malformed" | "unknown" | "parent";

export interface StandardResolution {
  input_code: string;
  status: StandardStatus;
  resolved: string[];
  suggestion: string | null;
  eld_label_mismatch: boolean;
}

export type Verdict = "fits" | "partial" | "mismatch";

export interface EldVerdictEntry {
  code: string;
  strand_part: string;
  strand: string;
  verdict: Verdict;
  suggested_remap: string | null;
  descriptions: { label: string; verdict: Verdict }[];
}

export type EldVerdictTable = Record<string, EldVerdictEntry>;

export const DEFAULT_STANDARDS_DIR: string = join(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "..",
  "data",
  "standards",
);

const TIER_RE = /^(ELD\..+)\.(Em|Ex|Br)$/;

function is_tier_code(code: string): boolean {
  return TIER_RE.test(code);
}

function normalize_label(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\.$/, "")
    .trim();
}

export class StandardsIndex {
  private constructor(
    private readonly by_code: Map<string, StandardRow>,
    private readonly leaves: Map<string, string[]>,
    private readonly verdicts: EldVerdictTable,
  ) {}

  static from_rows(
    rows: readonly StandardRow[],
    verdicts: EldVerdictTable = {},
  ): StandardsIndex {
    const by_code = new Map<string, StandardRow>();
    const leaves = new Map<string, string[]>();
    for (const row of rows) {
      by_code.set(row.code, row);
      if (is_tier_code(row.code) || row.parent_code === null) continue;
      const list = leaves.get(row.parent_code) ?? [];
      list.push(row.code);
      leaves.set(row.parent_code, list);
    }
    for (const list of leaves.values()) list.sort();
    return new StandardsIndex(by_code, leaves, verdicts);
  }

  leaves_of(code: string): string[] {
    const t = code.trim();
    const m = TIER_RE.exec(t);
    const base = m?.[1] ?? t;
    return [...(this.leaves.get(base) ?? [])];
  }

  text_of(code: string): string | null {
    return this.by_code.get(code.trim())?.text ?? null;
  }

  strand_of(code: string): string | null {
    return this.by_code.get(code.trim())?.eld_strand ?? null;
  }

  resolve(code: string, sheet_label: string | null = null): StandardResolution {
    const t = code.trim();
    const tier = TIER_RE.exec(t);
    const base = tier?.[1] ?? t;
    const result: StandardResolution = {
      input_code: code,
      status: "unknown",
      resolved: [],
      suggestion: null,
      eld_label_mismatch: false,
    };

    if (this.by_code.has(base)) {
      const kids = this.leaves_of(base);
      if (kids.length > 0) {
        result.status = "parent";
        result.resolved = kids;
      } else {
        result.status = "ok";
        result.resolved = [base];
      }
      this.apply_label_verdict(result, base, sheet_label);
      return result;
    }

    const msls = /^(\d)\.(\d)\.?([a-z])$/.exec(t);
    if (msls) {
      const candidate = `MSLS ${msls[1]}.${msls[2]}${msls[3]}`;
      if (this.by_code.has(candidate)) {
        result.status = "malformed";
        result.suggestion = candidate;
        return result;
      }
    }
    if (/^\d+\.\d+(\.[a-z])?$/.test(t)) {
      result.status = "malformed";
      return result;
    }
    const stripped = /^(.+\d)\.?[a-z]$/.exec(t)?.[1];
    if (stripped !== undefined && this.by_code.has(stripped))
      result.suggestion = stripped;
    return result;
  }

  private apply_label_verdict(
    result: StandardResolution,
    base: string,
    sheet_label: string | null,
  ): void {
    if (typeof sheet_label !== "string" || sheet_label.trim() === "") return;
    if (!base.startsWith("ELD.")) return;
    const key = base.replace(/^(.+\d)[a-z]$/, "$1");
    const entry = this.verdicts[key];
    if (entry === undefined) return;
    const wanted = normalize_label(sheet_label);
    const hit = entry.descriptions.find(
      (d) => normalize_label(d.label) === wanted,
    );
    if (hit !== undefined && hit.verdict === "mismatch") {
      result.eld_label_mismatch = true;
      if (entry.suggested_remap !== null)
        result.suggestion = entry.suggested_remap;
    }
  }
}

// ---- loading (the only place node:fs is used) -------------------------------------------------

function read_json(dir: string, file: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(path.join(dir, file), "utf8"),
  );
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function is_obj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rows_of(dir: string, file: string): StandardRow[] {
  const doc = read_json(dir, file);
  const header = doc["header"];
  const set = is_obj(header) ? header["set"] : undefined;
  if (set !== "CA_CCSS_ELA_6" && set !== "CA_ELD_6" && set !== "MSLS_6") {
    throw new Error(`${file}: header.set is missing or unknown`);
  }
  const list = doc["standards"];
  if (!Array.isArray(list))
    throw new Error(`${file}: standards must be an array`);
  return list.map((raw: unknown, i: number): StandardRow => {
    if (!is_obj(raw))
      throw new Error(`${file}: standards[${i}] is not an object`);
    const { code, text, parent_code, is_leaf, eld_strand } = raw;
    if (typeof code !== "string" || code === "")
      throw new Error(`${file}: standards[${i}].code`);
    if (typeof text !== "string" || text.trim() === "")
      throw new Error(`${file}: ${code} has no text`);
    if (parent_code !== null && typeof parent_code !== "string")
      throw new Error(`${file}: ${code}.parent_code`);
    if (typeof is_leaf !== "boolean")
      throw new Error(`${file}: ${code}.is_leaf`);
    if (eld_strand !== null && typeof eld_strand !== "string")
      throw new Error(`${file}: ${code}.eld_strand`);
    return { code, set, text, parent_code, is_leaf, eld_strand };
  });
}

export function load_standard_rows(
  dir: string = DEFAULT_STANDARDS_DIR,
): StandardRow[] {
  return [
    ...rows_of(dir, "ccss-ela-6.json"),
    ...rows_of(dir, "eld-6.json"),
    ...rows_of(dir, "msls-6.json"),
  ];
}

export function load_eld_verdicts(
  dir: string = DEFAULT_STANDARDS_DIR,
): EldVerdictTable {
  const file = "eld-verdicts.json";
  const list = read_json(dir, file)["verdicts"];
  if (!Array.isArray(list))
    throw new Error(`${file}: verdicts must be an array`);
  const table: EldVerdictTable = {};
  for (const raw of list as unknown[]) {
    if (!is_obj(raw) || typeof raw["code"] !== "string")
      throw new Error(`${file}: bad entry`);
    const v = raw["verdict"];
    if (v !== "fits" && v !== "partial" && v !== "mismatch")
      throw new Error(`${file}: ${raw["code"]} verdict`);
    if (!Array.isArray(raw["descriptions"]))
      throw new Error(`${file}: ${raw["code"]} descriptions`);
    table[raw["code"]] = raw as unknown as EldVerdictEntry;
  }
  return table;
}

export function load_standards_index(
  dir: string = DEFAULT_STANDARDS_DIR,
): StandardsIndex {
  return StandardsIndex.from_rows(
    load_standard_rows(dir),
    load_eld_verdicts(dir),
  );
}

/** Codes the ELD seed lists as the sheet's twelve (read from eld-6.json). */
export function load_eld_sheet_codes(
  dir: string = DEFAULT_STANDARDS_DIR,
): string[] {
  const list = read_json(dir, "eld-6.json")["sheet_codes"];
  if (!Array.isArray(list) || !list.every((c) => typeof c === "string")) {
    throw new Error("eld-6.json: sheet_codes must be a string array");
  }
  return list as string[];
}
