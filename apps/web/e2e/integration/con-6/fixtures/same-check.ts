// Every Reading lesson's draft AND repair is WP-1's first draft (it parses and compiles but fails the same check rule), relabelled
// with the lesson id, so lessons keep failing the same check and the circuit breaker pauses the run.
// Creating <gate dir>/fixed makes the worker answer with WP-1's good draft, relabelled (used to prove Resume continues).
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { StubModelClient } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { lesson_of, plan_for, text, wp1 } from "./common";
export function apply(stub: StubModelClient, rows: readonly NormalizedRow[]): void {
  const fixed = () => existsSync(join(process.env.CON6_GATE_DIR ?? "", "fixed"));
  const draft = (req: Parameters<typeof lesson_of>[0]) => text({ ...((fixed() ? wp1.draft : wp1.first_draft) as object), lesson_id: lesson_of(req) });
  stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));
  stub.script("GENERATION", "lesson_draft", draft);
  stub.script("REPAIR", "lesson_draft", draft);
}
