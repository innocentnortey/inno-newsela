// NL-09 AC-7 [invariant]
import { describe, expect, it } from "vitest";
import { canonical_json, content_hash } from "./content-hash.ts";
import type { StoredLesson } from "./lesson.ts";

const base = (): StoredLesson => ({
  lesson_id: "G6.U4.L4", schema_version: 1, title: "T", type: "Reading",
  front_matter: { standards: [], minutes_total: 50, vocabulary: ["a", "b"] },
  sections: [{ address: "launch", name: "Launch", minutes: 5, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] } }],
  text_cards: [],
});

describe("content_hash", () => {
  it("is independent of key order", () => {
    const a = base();
    const b = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(a).reverse()))) as StoredLesson;
    expect(content_hash(b)).toBe(content_hash(a));
  });
  it("changes on a one-char text change", () => {
    const b = base();
    (b.sections[0]!.content.content![0]!.content![0]!).text = "hj";
    expect(content_hash(b)).not.toBe(content_hash(base()));
  });
  it("changes on swapped array order", () => {
    const b = base();
    b.front_matter.vocabulary = ["b", "a"];
    expect(content_hash(b)).not.toBe(content_hash(base()));
  });
  it("distinguishes null from a missing key", () => {
    expect(canonical_json({ a: null })).toBe('{"a":null}');
    expect(canonical_json({})).toBe("{}");
    expect(canonical_json({ a: null })).not.toBe(canonical_json({ a: undefined }));
  });
  it("matches the recorded constant", () => {
    // canonical form, read by eye: keys sorted, no whitespace.
    expect(canonical_json({ b: [1, "x"], a: { d: null, c: true } })).toBe('{"a":{"c":true,"d":null},"b":[1,"x"]}');
    expect(content_hash(base())).toBe("5094e4e0ba0ec1d1a3eb8348cfd452ef385cf920cf2b5c7b9556e139776ff053");
  });
  it("throws on non-finite numbers", () => expect(() => canonical_json({ a: NaN })).toThrow(TypeError));
});
