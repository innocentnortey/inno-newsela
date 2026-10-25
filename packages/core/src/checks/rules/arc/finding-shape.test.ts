import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  make_ctx,
  p,
  reading_lesson,
  routine,
  section,
} from "../../test-helpers.ts";
import type { DerivedRow } from "../../types.ts";
import { RULES } from "./index.ts";

const FIELDS = [
  "kind",
  "level",
  "message",
  "address",
  "span_anchor",
  "related_lesson_id",
  "code",
];

describe("arc finding shape", () => {
  it("arc_findings_have_every_field", () => {
    const mk = (n: number) => {
      const id = `G6.U4.L${n}`;
      const b = reading_lesson();
      return {
        ...b,
        lesson_id: id,
        sections: [
          section("Launch", id, 5, [routine("reading", "x"), p("y")]),
          ...b.sections.slice(1),
        ],
      };
    };
    const d = (n: number) =>
      ({
        lesson_id: `G6.U4.L${n}`,
        seq: 1,
        store_id: "s",
        lesson: mk(n),
        content_hash: "0".repeat(64),
      }) as DerivedRow;
    const ctx = {
      ...make_ctx(mk(8)),
      linked_lessons: [d(6), d(7)],
      unit_coverage: [
        { code: "RL.6.1", lesson_id: "G6.U4.L8", role: "A" },
      ] as unknown as ReturnType<typeof make_ctx>["unit_coverage"],
    };
    const findings = RULES.flatMap((r) => r.run(ctx, DEFAULT_POLICY));
    expect(findings.length).toBeGreaterThanOrEqual(2);
    for (const f of findings) {
      expect(Object.keys(f).sort()).toEqual([...FIELDS].sort());
      expect(f.level).toBe("advisory");
      expect(f.message.length).toBeGreaterThan(0);
    }
  });
});
