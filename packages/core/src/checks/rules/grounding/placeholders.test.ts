import { describe, expect, it } from "vitest";
import type { PMNode } from "@ls/schema/lesson";
import { CHECK_POLICY } from "../../policy.ts";
import type { CheckContext } from "../../types.ts";
import { walk } from "../structural/doc-walk.ts";
import { build_ctx } from "./fixtures/build.ts";
import { RULES } from "./index.ts";

const OPEN = ["quote_placeholder_open", "excerpt_slot_open", "rights_to_clear"];
const open_findings = (ctx: CheckContext) =>
  RULES.flatMap((r) => r.run(ctx, CHECK_POLICY)).filter((f) => OPEN.includes(f.kind));

function edit(ctx: CheckContext, type: string, fn: (n: PMNode) => void): CheckContext {
  const lesson = structuredClone(ctx.lesson);
  for (const s of lesson.sections) walk(s.content, (n) => { if (n.type === type) fn(n); });
  return { ...ctx, lesson };
}

describe("placeholders and slots", () => {
  it("wp1 has one open placeholder and one open excerpt slot", () => {
    const found = open_findings(build_ctx("wp1"));
    expect(found.map((f) => f.kind).sort()).toEqual(["excerpt_slot_open", "quote_placeholder_open"]);
    expect(found.find((f) => f.kind === "quote_placeholder_open")?.address).toMatch(/\.PartA$/);
  });

  it("wp2 slot left to clear gives an open slot and a rights flag; filling clears both", () => {
    const ctx = edit(build_ctx("wp2"), "excerpt_slot", (n) => {
      n.attrs = { ...n.attrs, rights: "to-clear", source_ref: null };
    });
    expect(open_findings(ctx).map((f) => f.kind).sort()).toEqual(["excerpt_slot_open", "rights_to_clear"]);
    const filled = edit(ctx, "excerpt_slot", (n) => {
      n.attrs = { ...n.attrs, rights: "public-domain", source_ref: "Zanzibar Tales, ch. 1" };
    });
    expect(open_findings(filled)).toEqual([]);
  });

  it("wp3 has none", () => {
    expect(open_findings(build_ctx("wp3"))).toEqual([]);
  });

  it("replacing the wp1 placeholder with a sourced quote clears its finding", () => {
    const ctx = build_ctx("wp1");
    const lesson = structuredClone(ctx.lesson);
    for (const s of lesson.sections) {
      walk(s.content, (n) => {
        (n.content ?? []).forEach((c, i) => {
          if (c.type !== "quote_placeholder") return;
          n.content![i] = {
            type: "quote",
            attrs: { slot_id: c.attrs?.slot_id, rights: "public-domain", source_ref: "The Lightning Thief ch. 1" },
            content: [{ type: "paragraph", content: [{ type: "text", text: "A short line." }] }],
          };
        });
      });
    }
    const found = open_findings({ ...ctx, lesson });
    expect(found.map((f) => f.kind)).toEqual(["excerpt_slot_open"]);
  });
});
