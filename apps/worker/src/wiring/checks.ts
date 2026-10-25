// Shell. Filled by NL-81 (A6).
import type { WorkerDeps } from "../deps-types.ts";

export const FILLER = "NL-81" as const;
export type CheckWiring = Record<string, never>;
export function wire_checks(_d: WorkerDeps): CheckWiring {
  return {};
}
