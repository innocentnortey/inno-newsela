// Wiring stub (NL-06). Filled by NL-54. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface MetricsWiring {
  board: undefined;
  heartbeats: undefined;
}

export function wire_metrics(_d: WebDeps): MetricsWiring {
  void _d;
  return {
    board: undefined,
    heartbeats: undefined,
  };
}
