// Wiring stub (NL-06). Filled by NL-91. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface CoverageWiring {
  coverage: undefined;
}

export function wire_coverage(_d: WebDeps): CoverageWiring {
  void _d;
  return {
    coverage: undefined,
  };
}
