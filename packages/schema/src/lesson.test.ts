// NL-09 AC-6 [invariant|negative]
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ProseMirrorDoc, StoredLesson } from "./lesson.ts";

const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "strong" }, { type: "link", attrs: { href: "x" } }] }] }],
};
const lesson = (o: Record<string, unknown> = {}) => ({
  lesson_id: "G6.U4.L4", schema_version: 1, title: "T", type: "Reading",
  front_matter: { standards: [], minutes_total: 50, vocabulary: [] },
  sections: [{ address: "launch", name: "Launch", minutes: 5, content: doc }],
  text_cards: [], ...o,
});

describe("StoredLesson", () => {
  it("accepts nested nodes with marks", () => {
    expect(StoredLesson.safeParse(lesson()).success).toBe(true);
    expect(ProseMirrorDoc.parse(doc)).toEqual(doc);
  });
  it("rejects non-doc root", () => expect(ProseMirrorDoc.safeParse({ type: "paragraph" }).success).toBe(false));
  it("rejects malformed nodes", () => {
    expect(ProseMirrorDoc.safeParse({ type: "doc", content: [{}] }).success).toBe(false);
    expect(ProseMirrorDoc.safeParse({ type: "doc", content: [{ type: 5 }] }).success).toBe(false);
  });
  it("rejects schema_version 0", () => expect(StoredLesson.safeParse(lesson({ schema_version: 0 })).success).toBe(false));
  it("imports no forbidden package", () => {
    const dir = new URL(".", import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
      const s = readFileSync(new URL(f, dir), "utf8");
      expect(s).not.toMatch(/@ls\/(editor-schema|core|db|llm|ydoc)/);
    }
  });
});
