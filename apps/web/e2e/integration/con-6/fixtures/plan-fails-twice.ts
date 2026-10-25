// The first 1 + PROVIDER_MAX_RETRIES (default 4) unit_plan calls fail with a retryable provider error, so the paid caller's retries are
// spent and the run pauses; the next call (after Resume) succeeds. Two failures alone are absorbed by the retries (observed). Lessons use script A.
import { ProviderError } from "@ls/core/errors";
import type { StubModelClient } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { plan_for, script_good } from "./common";
export function apply(stub: StubModelClient, rows: readonly NormalizedRow[]): void {
  script_good(stub, rows);
  let n = 0;
  const boom = new ProviderError({ kind: "overloaded", http_status: 529 });
  stub.script("GENERATION", "unit_plan", (req) => (++n <= 1 + Number(process.env.PROVIDER_MAX_RETRIES ?? 3) ? { kind: "error", error: boom } : plan_for(rows, req)));
}
