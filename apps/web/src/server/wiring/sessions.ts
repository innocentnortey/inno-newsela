// Wiring stub (NL-06). Filled by NL-25. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface SessionWiring {
  sessions: undefined;
}

export function wire_sessions(_d: WebDeps): SessionWiring {
  void _d;
  return {
    sessions: undefined,
  };
}
