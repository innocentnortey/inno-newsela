// Script A: row 8 (L4) fails its first draft and is repaired, row 9 (L5) passes, any other row gets the re-labelled WP-2 draft.
import type { StubModelClient } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { script_good } from "./common";
export function apply(stub: StubModelClient, rows: readonly NormalizedRow[]): void {
  script_good(stub, rows);
}
