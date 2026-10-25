// Wiring stub (NL-06). Filled by NL-34. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface PromptWiring {
  prompts: undefined;
}

export function wire_prompts(_d: WebDeps): PromptWiring {
  void _d;
  return {
    prompts: undefined,
  };
}
