// NL-121 (frozen first): the Postgres GeneratedReader returns the facts of the generated version, nothing else. Needs scripts/test-db.sh up.
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import { make_world, wp1, type World } from "../seed/test-world.ts";
import { make_pg_generated_reader } from "./generated.ts";

let w: World;
beforeAll(async () => {
  w = await make_world();
  const repo = new PgLessonRepo({ db: w.t.db, ids: w.ids, clock: w.clock });
  await w.t.db.with_tx(async (tx) => {
    await tx.query("UPDATE lesson SET number=4 WHERE id='G6.U4.L4'");
    await repo.write_generated_version({
      lesson_id: "G6.U4.L4", unit_id: "G6.U4", kind: "generated", lesson: wp1(), draft: {} as LessonDraft, content_hash: "a".repeat(64),
      provenance: {
        outline_row_hash: "a".repeat(64), prompt_version_id: "pv1", model: "m", parameters: {}, schema_version: 1, example_set_id: null,
        run_id: null as never, model_call_ids: [], cost_usd: new Decimal("0"), ai_assisted_spans: 0, derived_from_version_id: null,
      },
      idempotency_key: "nl121-g4",
    } as never, tx);
  });
}, 120_000);
afterAll(async () => w.close());

describe("make_pg_generated_reader", () => {
  it("returns type, section names and non-removed focus codes of the generated version, keyed by lesson number", async () => {
    const lesson = wp1();
    const got = await make_pg_generated_reader(w.t.db).lessons("G6.U4");
    expect(got.without_number).toBe(0);
    expect(got.lessons).toHaveLength(1);
    expect(got.lessons[0]).toEqual({
      number: 4,
      facts: {
        type: lesson.type,
        sections: lesson.sections.map((s) => s.name),
        focus: lesson.front_matter.standards.filter((s) => s.role === "focus" && s.confirmation !== "removed").map((s) => s.code),
      },
    });
  });
});
