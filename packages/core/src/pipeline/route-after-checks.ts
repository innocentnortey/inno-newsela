import type { NextStep, RouteInput } from "./state.ts";

export function route_after_checks(i: RouteInput): NextStep {
  if (i.schema_valid && i.compiled && i.check_passed) return "store";
  if (i.repair_rounds < i.max_repair_rounds) return "repair";
  return "fail";
}
