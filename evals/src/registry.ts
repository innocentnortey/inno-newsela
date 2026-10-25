// NL-49
import type { SuiteFactory, SuiteName } from "./types.ts";
import { make_s1 } from "./suites/s1.ts";
import { make_s2 } from "./suites/s2.ts";
import { make_s3 } from "./suites/s3.ts";
import { make_s4 } from "./suites/s4.ts";
import { make_s5 } from "./suites/s5.ts";
import { make_s6 } from "./suites/s6.ts";
import { make_s7 } from "./suites/s7.ts";
import { make_s8 } from "./suites/s8.ts";
import { make_s9 } from "./suites/s9.ts";
import { make_s10 } from "./suites/s10.ts";
import { make_s11 } from "./suites/s11.ts";
import { make_s12 } from "./suites/s12.ts";
import { make_s13 } from "./suites/s13.ts";
import { make_s14 } from "./suites/s14.ts";

export const default_suite_factory: SuiteFactory = (mode) => [make_s1(mode), make_s2(mode), make_s3(mode), make_s4(mode), make_s5(mode), make_s6(mode), make_s7(mode), make_s8(mode), make_s9(mode), make_s10(mode), make_s11(mode), make_s12(mode), make_s13(mode), make_s14(mode)];

export const SUITE_ALIASES: Record<string, SuiteName> = {
  intake: "S1", checks: "S2", drafts: "S3", grounding: "S4", integrity: "S5", faults: "S6", safety: "S7",
  heartbeat: "S8", "full-run": "S9", seed: "S10", heldout: "S11", "judge-calibrate": "S12", rating: "S13", load: "S14",
};

export function resolve_suite(name: string): SuiteName | null {
  const alias = SUITE_ALIASES[name.toLowerCase()];
  if (alias !== undefined) return alias;
  const m = /^s(\d{1,2})$/i.exec(name);
  if (m === null) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 14 ? (`S${n}` as SuiteName) : null;
}
