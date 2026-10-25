import { describe, expect, it } from "vitest";
import type { PMNode } from "@ls/schema/lesson";
import { CHECK_POLICY } from "../../policy.ts";
import { make_ctx, reading_lesson, section } from "../../test-helpers.ts";
import { quote_too_long_rule } from "./quote_too_long.ts";
import { quote_without_source_rule } from "./quote_without_source.ts";
import { rights_to_clear_rule } from "./rights_to_clear.ts";

const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const quote = (attrs: Record<string, unknown>, text = "A short line."): PMNode => ({
  type: "quote",
  attrs,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const ctx_with = (node: PMNode) => {
  const lesson = reading_lesson();
  lesson.sections[0] = section("Launch", lesson.lesson_id, 5, [node]);
  return make_ctx(lesson);
};
const ok = { rights: "public-domain", source_ref: "Zanzibar Tales, ch. 1" };

describe("quote nodes", () => {
  it("a quote with no source_ref is blocking", () => {
    const found = quote_without_source_rule.run(ctx_with(quote({ rights: "licensed", source_ref: null })), CHECK_POLICY);
    expect(found).toHaveLength(1);
    expect(quote_without_source_rule.run(ctx_with(quote(ok)), CHECK_POLICY)).toEqual([]);
  });
  it("a 13-word short quote is too long, 12 words is not", () => {
    const attrs = { rights: "short-quote-commentary", source_ref: "x" };
    expect(quote_too_long_rule.run(ctx_with(quote(attrs, words(13))), CHECK_POLICY)).toHaveLength(1);
    expect(quote_too_long_rule.run(ctx_with(quote(attrs, words(12))), CHECK_POLICY)).toEqual([]);
  });
  it("to-clear rights block, licensed does not", () => {
    expect(rights_to_clear_rule.run(ctx_with(quote({ ...ok, rights: "to-clear" })), CHECK_POLICY)).toHaveLength(1);
    expect(rights_to_clear_rule.run(ctx_with(quote({ ...ok, rights: "licensed" })), CHECK_POLICY)).toEqual([]);
  });
});
