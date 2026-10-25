// Shell. Filled by NL-79 (A9).
import type { WorkerDeps } from "../deps-types.ts";

export const FILLER = "NL-79" as const;
export type GenerationWiring = Record<string, never>;
export function wire_generation(_d: WorkerDeps): GenerationWiring {
  return {};
}
