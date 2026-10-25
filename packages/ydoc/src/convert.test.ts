import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { StoredLesson } from "@ls/schema/lesson";
import { SchemaUnknownError } from "@ls/editor-schema/schema";
import { content_hash } from "./hash.ts";
import { lesson_to_ydoc, ydoc_to_lesson } from "./convert.ts";

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const stored = (): StoredLesson => read("../tests/fixtures/stored-wp1.json");
const allNodes = (): StoredLesson => {
  const base = stored();
  return {
    ...base,
    sections: [
      { address: "all_nodes", name: "All", minutes: 50, content: read("../../editor-schema/tests/fixtures/all-nodes.json") },
    ],
  };
};

function firstText(n: Y.XmlFragment | Y.XmlElement): Y.XmlText | null {
  for (const c of n.toArray()) {
    if (c instanceof Y.XmlText) return c;
    if (c instanceof Y.XmlElement) {
      const t = firstText(c);
      if (t) return t;
    }
  }
  return null;
}

function editSection(doc: Y.Doc, address: string): void {
  const t = firstText(doc.getXmlFragment("section:" + address));
  if (!t) throw new Error("no text");
  t.insert(0, "X");
}

function handBuilt(fill: (frag: Y.XmlFragment) => void, version = 1): Uint8Array {
  const doc = new Y.Doc();
  const fm = doc.getMap("front_matter");
  fm.set("lesson_id", "G6.U4.L4");
  fm.set("title", "t");
  fm.set("type", "Reading");
  fm.set("standards", []);
  fm.set("vocabulary", []);
  fm.set("minutes_total", 1);
  fm.set("text_cards", []);
  fm.set("schema_version", version);
  doc.getArray<string>("section_order").push(["s"]);
  doc.getMap("section_meta").set("s", { name: "S", minutes: 1 });
  fill(doc.getXmlFragment("section:s"));
  return Y.encodeStateAsUpdate(doc);
}

describe("roundtrip_hash_identity", () => {
  it.each([
    ["stored-wp1", stored],
    ["all-nodes", allNodes],
  ])("%s", (_n, make) => {
    const lesson = make();
    const back = ydoc_to_lesson(lesson_to_ydoc(lesson), 1);
    expect(content_hash(back)).toBe(content_hash(lesson));
  });
});

describe("deterministic_and_shape", () => {
  it("is byte-identical across runs", () => {
    expect(Buffer.from(lesson_to_ydoc(stored())).equals(Buffer.from(lesson_to_ydoc(stored())))).toBe(true);
  });
  it("has the expected top-level shape", () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, lesson_to_ydoc(stored()));
    expect([...doc.getMap("front_matter").keys()].sort()).toEqual(
      ["lesson_id", "minutes_total", "schema_version", "standards", "text_cards", "title", "type", "vocabulary"],
    );
    expect(doc.getArray("section_order").toArray()).toEqual(["launch", "literacy_lab", "wrap_up"]);
    expect([...doc.getMap("section_meta").keys()].sort()).toEqual(["launch", "literacy_lab", "wrap_up"]);
    expect(doc.getXmlFragment("section:launch").length).toBeGreaterThan(0);
  });
});

describe("section_isolation", () => {
  it("editing one section leaves the others' content unchanged", () => {
    const base = lesson_to_ydoc(stored());
    const doc = new Y.Doc();
    Y.applyUpdate(doc, base);
    editSection(doc, "literacy_lab");
    const after = ydoc_to_lesson(Y.encodeStateAsUpdate(doc), 1);
    const before = stored();
    expect(after.sections[0]).toEqual(before.sections[0]);
    expect(after.sections[2]).toEqual(before.sections[2]);
    expect(after.sections[1]).not.toEqual(before.sections[1]);
  });
});

describe("merge_converges", () => {
  it("concurrent edits to different sections converge in either order", () => {
    const base = lesson_to_ydoc(stored());
    const d1 = new Y.Doc();
    const d2 = new Y.Doc();
    Y.applyUpdate(d1, base);
    Y.applyUpdate(d2, base);
    editSection(d1, "literacy_lab");
    editSection(d2, "wrap_up");
    const u1 = Y.encodeStateAsUpdate(d1);
    const u2 = Y.encodeStateAsUpdate(d2);
    Y.applyUpdate(d1, u2);
    Y.applyUpdate(d2, u1);
    const h1 = content_hash(ydoc_to_lesson(Y.encodeStateAsUpdate(d1), 1));
    const h2 = content_hash(ydoc_to_lesson(Y.encodeStateAsUpdate(d2), 1));
    expect(h1).toBe(h2);
    expect(h1).not.toBe(content_hash(stored()));
  });
});

describe("unknown_nodes_refused", () => {
  it("embed element", () => {
    const bytes = handBuilt((f) => f.insert(0, [new Y.XmlElement("embed")]));
    let err: unknown;
    try {
      ydoc_to_lesson(bytes, 1);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SchemaUnknownError);
    expect((err as SchemaUnknownError).unknown_nodes).toContain("embed");
  });
  it("schema_version 2", () => {
    expect(() => ydoc_to_lesson(lesson_to_ydoc(stored()), 2)).toThrow(SchemaUnknownError);
  });
  it("unknown mark", () => {
    const bytes = handBuilt((f) => {
      const p = new Y.XmlElement("paragraph");
      f.insert(0, [p]);
      const t = new Y.XmlText();
      p.insert(0, [t]);
      t.insert(0, "hi", { bogus_mark: {} });
    });
    let err: unknown;
    try {
      ydoc_to_lesson(bytes, 1);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SchemaUnknownError);
    expect(JSON.stringify((err as SchemaUnknownError).unknown_nodes)).toContain("bogus_mark");
  });
  it("lesson_to_ydoc refuses an unknown node", () => {
    const l = stored();
    l.sections[0]!.content = { type: "doc", content: [{ type: "embed" }] } as never;
    expect(() => lesson_to_ydoc(l)).toThrow(SchemaUnknownError);
  });
});
