// L5 (row 9) fails its draft and its repair (empty object). Rows 8 and 25 are ready.
// Creating <gate dir>/fixed makes L5 answer with a good draft, so Retry failed can be shown to succeed.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { StubModelClient } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { L4, L5, good_draft, lesson_of, plan_for, text, wp1 } from "./common";
export function apply(stub: StubModelClient, rows: readonly NormalizedRow[]): void {
  const fixed = () => existsSync(join(process.env.CON6_GATE_DIR ?? "", "fixed"));
  const broken = (id: string) => id === L5 && !fixed();
  stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));
  stub.script("GENERATION", "lesson_draft", (req) => {
    const id = lesson_of(req);
    return broken(id) ? { kind: "text", text: "{}" } : text(id === L4 ? wp1.first_draft : good_draft(id));
  });
  stub.script("REPAIR", "lesson_draft", (req) => (broken(lesson_of(req)) ? { kind: "text", text: "{}" } : text(good_draft(lesson_of(req)))));
}
