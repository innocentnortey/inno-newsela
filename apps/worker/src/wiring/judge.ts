// Shell. Filled by NL-110 (A19).
import type { WorkerDeps } from "../deps-types.ts";

export const FILLER = "NL-110" as const;
export type JudgeWiring = Record<string, never>;
export function wire_judge(_d: WorkerDeps): JudgeWiring {
  return {};
}
