// Wiring stub (NL-06). Filled by NL-102. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface ExportWiring {
  exports: undefined;
}

export function wire_exports(_d: WebDeps): ExportWiring {
  void _d;
  return {
    exports: undefined,
  };
}
