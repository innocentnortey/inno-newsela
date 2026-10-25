import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StoredLesson } from "@ls/schema/lesson";
import { NormalizedRow } from "@ls/schema/outline";
import { DEFAULT_POLICY, make_ctx } from "../../test-helpers.ts";
import { RULES } from "./index.ts";

const json = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const fx = "../../../../tests/fixtures/";

describe("arc rules on shipped fixtures", () => {
  it("fixtures_raise_at_most_one_arc_finding", () => {
    const lessons = [
      StoredLesson.parse(json("../../fixtures/wp3-clean.json")),
      StoredLesson.parse(
        json("../../../../../ydoc/tests/fixtures/stored-wp1.json"),
      ),
    ];
    for (const name of ["row-wp1", "row-wp3", "row-wp4"]) {
      const row = NormalizedRow.parse(json(`${fx}${name}.json`));
      for (const lesson of lessons) {
        const ctx = { ...make_ctx(lesson), row };
        const n = RULES.flatMap((r) => r.run(ctx, DEFAULT_POLICY)).length;
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });
});
