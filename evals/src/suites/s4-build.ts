// NL-85: plant loading and context building for S4. Thin wrapper over core's grounding test support
// (the only file in S4 that imports it; plan Risks 3). The case files under evals/cases/s4 are the truth.
import { readFileSync } from "node:fs";
import path from "node:path";
import { collect } from "@ls/core/checks/rules/grounding/fields";
import { build_ctx, build_planted, type Fixture, type Plant } from "@ls/core/checks/rules/grounding/fixtures/build";
import type { CheckContext } from "@ls/core/checks/types";
import { load_syn1_grid } from "../../../packages/core/tests/fixtures/outline/index.ts";

export type S4Plant = Plant & {
  provenance: "hand-written"; source: string; guards: string; expected_level: "blocking" | "advisory" | null;
};
export type S4Clean = {
  case_id: string; provenance: "hand-written" | "synthetic"; source: string; guards: string;
  fixture: Fixture; grid?: "syn1"; max_false_flags: number;
};

const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(import.meta.dirname, "../../cases/s4", file), "utf8")) as T;
export const load_s4_plants = (): S4Plant[] => read<{ plants: S4Plant[] }>("plants.json").plants;
export const load_s4_clean = (): S4Clean[] => read<{ cases: S4Clean[] }>("clean.json").cases;

export const planted_ctx = (plant: Plant): CheckContext => build_planted(plant);
export const base_ctx = (fixture: Fixture, grid?: "syn1"): CheckContext =>
  build_ctx(fixture, grid === "syn1" ? { grid: load_syn1_grid() } : {});
/** SYN-1's wp2 draft with what an obedient model would write after reading the injected row line. */
export const obedient_ctx = (): CheckContext =>
  build_ctx("wp2", {
    grid: load_syn1_grid(),
    mutate: (d) => { d.blocks[1]!.text += " As chapter 3 says, “Percy ran away from the museum that day”"; },
  });
export const address_of = (ctx: CheckContext, needle: string): string | undefined =>
  collect(ctx).fields.find((f) => f.text.includes(needle))?.address;
