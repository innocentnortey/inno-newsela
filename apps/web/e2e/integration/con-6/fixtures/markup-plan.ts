// Script A, but the first plan entry's purpose carries markup, and L5's failure text is irrelevant (it is ready).
import type { StubModelClient } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { plan_for, script_good } from "./common";
import { MARKUP } from "./markup";
export function apply(stub: StubModelClient, rows: readonly NormalizedRow[]): void {
  script_good(stub, rows);
  stub.script("GENERATION", "unit_plan", (req) =>
    plan_for(rows, req, (json) => {
      const plan = JSON.parse(json) as { entries: { purpose: string }[] };
      plan.entries[0]!.purpose = `${MARKUP}Read closely</b>`;
      return JSON.stringify(plan);
    }),
  );
}
