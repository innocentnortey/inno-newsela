// Wiring stub (NL-06). Filled by NL-78. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface RunWiring {
  runs: undefined;
}

export function wire_runs(_d: WebDeps): RunWiring {
  void _d;
  return {
    runs: undefined,
  };
}
