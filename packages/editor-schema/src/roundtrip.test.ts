import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EDITOR_SCHEMA,
  MARK_NAMES,
  NODE_NAMES,
  type ProseMirrorDoc,
} from "./schema.ts";

const load = (f: string): ProseMirrorDoc =>
  JSON.parse(
    readFileSync(new URL(`../tests/fixtures/${f}`, import.meta.url), "utf8"),
  ) as ProseMirrorDoc;

function seen(
  d: ProseMirrorDoc,
  nodes: Set<string>,
  marks: Set<string>,
  counter = { n: 0 },
): number {
  counter.n += 1;
  nodes.add(d.type);
  for (const m of d.marks ?? []) marks.add(m.type);
  for (const c of d.content ?? []) seen(c, nodes, marks, counter);
  return counter.n;
}

describe("roundtrip", () => {
  for (const f of ["all-nodes.json", "reading-wp1.json"]) {
    it(`${f} round-trips unchanged, key order included`, () => {
      const json = load(f);
      const node = EDITOR_SCHEMA.nodeFromJSON(json);
      node.check();
      const out = node.toJSON() as unknown;
      expect(out).toEqual(json);
      expect(JSON.stringify(out)).toBe(JSON.stringify(json));
    });
  }

  it("all-nodes covers every node type and mark, with at least 22 node instances", () => {
    const nodes = new Set<string>();
    const marks = new Set<string>();
    const count = seen(load("all-nodes.json"), nodes, marks);
    expect([...nodes].sort()).toEqual([...NODE_NAMES].sort());
    expect([...marks].sort()).toEqual([...MARK_NAMES].sort());
    expect(count).toBeGreaterThanOrEqual(22);
  });

  it("reading-wp1 has the WP-1 Reading shape", () => {
    const nodes = new Set<string>();
    seen(load("reading-wp1.json"), nodes, new Set());
    for (const n of [
      "routine_heading",
      "callout",
      "table",
      "table_header",
      "quote_placeholder",
      "excerpt_slot",
      "teacher_tip",
    ]) {
      expect(nodes.has(n)).toBe(true);
    }
  });
});
