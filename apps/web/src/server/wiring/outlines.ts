// Wiring stub (NL-06). Filled by NL-26. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface OutlineWiring {
  outlines: undefined;
}

export function wire_outlines(_d: WebDeps): OutlineWiring {
  void _d;
  return {
    outlines: undefined,
  };
}
