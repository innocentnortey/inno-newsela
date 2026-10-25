// NL-84: shared loader for the suite case files under evals/cases/<suite>/. A case without provenance,
// source or guards can never be scored: the loader refuses the file (DO-5 Case provenance).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import type { JsonValue } from "@ls/core/ports/common";
import type { EvalCase } from "../types.ts";

const PROVENANCE: readonly EvalCase["provenance"][] = ["issued", "hand-written", "synthetic", "promoted-trace"];

export interface CaseFile extends EvalCase {
  input: JsonValue;
  note?: string;
}

const blank = (v: unknown): boolean => typeof v !== "string" || v.trim() === "";

export function parse_case_file(file_name: string, text: string, input_path: string): CaseFile {
  const raw = JSON.parse(text) as Record<string, unknown>;
  const case_id = raw["case_id"];
  if (blank(case_id) || `${case_id as string}.json` !== file_name) throw new InvariantViolation("case_id must equal the file name", { file: file_name });
  const provenance = raw["provenance"] as EvalCase["provenance"];
  if (!PROVENANCE.includes(provenance)) throw new InvariantViolation("case has no valid provenance", { file: file_name });
  if (blank(raw["source"])) throw new InvariantViolation("case has no source", { file: file_name });
  if (blank(raw["guards"])) throw new InvariantViolation("case has no guards", { file: file_name });
  if (raw["input"] === undefined || raw["expected"] === undefined) throw new InvariantViolation("case needs input and expected", { file: file_name });
  const out: CaseFile = {
    case_id: case_id as string, provenance, source: raw["source"] as string, guards: raw["guards"] as string,
    input_path, expected: raw["expected"] as JsonValue, input: raw["input"] as JsonValue,
  };
  if (typeof raw["note"] === "string") out.note = raw["note"];
  return out;
}

/** Reads every `<suite_prefix>*.json` in `dir_abs` in sorted file-name order. `repo_rel` is the repo-relative dir. */
export function load_cases(dir_abs: string, repo_rel: string, suite_prefix: string): CaseFile[] {
  return readdirSync(dir_abs)
    .filter((f) => f.endsWith(".json") && f.startsWith(suite_prefix) && !f.endsWith("manifest.json"))
    .sort()
    .map((f) => parse_case_file(f, readFileSync(path.join(dir_abs, f), "utf8"), `${repo_rel}/${f}`));
}
