// NL-49 shell, filled by NL-111. Cases are the labelled pairs; the calibration report comes only from `eval:judge-calibrate`.
import fs from "node:fs";
import path from "node:path";
import { NotImplemented } from "../errors.ts";
import { parse_labels } from "../judge-calibrate/labels.ts";
import type { CaseOutcome, EvalCase, EvalOptions, EvalSuite, ProviderMode } from "../types.ts";

const LABELS = path.join(import.meta.dirname, "../../judge/labels.csv");

/** `replay` runs one pair through judge_pair with its lesson and standard text; it needs a database, so the default has none. */
export function make_s12(_provider_mode: ProviderMode, replay?: (c: EvalCase, opts: EvalOptions) => Promise<CaseOutcome>): EvalSuite {
  return {
    name: "S12",
    cases: () => {
      if (!fs.existsSync(LABELS)) return []; // empty: the CLI exits 2 as for every shell
      return parse_labels(fs.readFileSync(LABELS, "utf8")).map((r) => ({
        case_id: r.pair_id, provenance: "issued" as const, source: `labels.csv:${r.pair_id}`, guards: "R-23", input_path: "evals/judge/labels.csv", expected: r.label,
      }));
    },
    score: async (c, opts) => {
      if (replay === undefined) throw new NotImplemented("suite S12 score (use npm run eval:judge-calibrate)", "NL-111");
      return replay(c, opts);
    },
  };
}
