// Wiring stub (NL-06). Filled by NL-53. Until then every service is unset.
import type { WebDeps } from "../deps.ts";

export interface ReviewWiring {
  lesson_reads: undefined;
  issues: undefined;
  slots: undefined;
  candidates: undefined;
  transitions: undefined;
  approvals: undefined;
}

export function wire_review(_d: WebDeps): ReviewWiring {
  void _d;
  return {
    lesson_reads: undefined,
    issues: undefined,
    slots: undefined,
    candidates: undefined,
    transitions: undefined,
    approvals: undefined,
  };
}
