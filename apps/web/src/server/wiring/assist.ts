// Wiring stub (NL-06). Filled by NL-116. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface AssistWiring {
  suggestions: undefined;
}

export function wire_assist(_d: WebDeps): AssistWiring {
  void _d;
  return {
    suggestions: undefined,
  };
}
