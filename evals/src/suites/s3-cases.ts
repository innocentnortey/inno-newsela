// NL-109 (S3): loads the three hand-written case folders evals/cases/drafts/wp-N/{input,expected}.json through the
// shared case-file validator (parse_case_file), so a case without provenance, source or guards is refused.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { S3Expected } from "./s3-assertions.ts";
import { parse_case_file, type CaseFile } from "./case-files.ts";

export const S3_CASE_IDS = ["wp-1", "wp-2", "wp-3"] as const;
export const DRAFTS_DIR = path.resolve(import.meta.dirname, "../../cases/drafts");
export const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface S3Input { pair: string; unit_id: string; sheet_row: number; lesson_id: string; outline_fixture: string; note: string }
export interface S3CaseEntry { file: CaseFile; input: S3Input; expected: S3Expected }

const GUARDS: Record<string, string> = {
  "wp-1": "every required typed block, minutes 50 +/- 5, exactly 2 placeholders, no quote node, origin on every code, L4 -> L5 link blocks submit and approve, trajectory names first failing step and FC-n",
  "wp-2": "every required typed block, minutes 50 +/- 5, exactly 1 placeholder (excerpt slot), no quote node, origin on every code, trajectory names first failing step and FC-n",
  "wp-3": "every required typed block, minutes 50 +/- 5, zero placeholders, no quote node, an added code keeps origin added, trajectory names first failing step and FC-n",
};

export function load_s3_cases(dir: string = DRAFTS_DIR): S3CaseEntry[] {
  return S3_CASE_IDS.map((id) => {
    const input = JSON.parse(readFileSync(path.join(dir, id, "input.json"), "utf8")) as S3Input;
    const expected = JSON.parse(readFileSync(path.join(dir, id, "expected.json"), "utf8")) as S3Expected;
    const text = JSON.stringify({ case_id: id, provenance: "hand-written", source: input.pair, guards: GUARDS[id], input, expected });
    const file = parse_case_file(`${id}.json`, text, `evals/cases/drafts/${id}/input.json`);
    return { file, input, expected };
  });
}
