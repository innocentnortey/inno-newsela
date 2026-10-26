// NL-49
import type { SuiteName } from "@ls/core/ports/evidence";

// Acceptance floor per suite. 1.0 = deterministic, no model ("floor 1.00" suites).
// A filling ticket may change only its own suite's row, with its own AC.
export const ACCEPTANCE_FLOOR: Record<SuiteName, number> = {
  S1: 1.0, S2: 1.0, S3: 0, S4: 1.0, S5: 1.0, S6: 1.0, S7: 1.0,
  S8: 0, S9: 0, S10: 0, S11: 0, S12: 0, S13: 0, S14: 0,
};

export function floor_met(suite: SuiteName, passed: number, total: number): boolean {
  return total > 0 && passed / total >= ACCEPTANCE_FLOOR[suite];
}
