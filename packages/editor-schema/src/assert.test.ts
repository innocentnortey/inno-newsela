import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SchemaUnknownError } from "./errors.ts";
import { assert_known_nodes, type ProseMirrorDoc } from "./schema.ts";

const reading = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/reading-wp1.json", import.meta.url),
    "utf8",
  ),
) as ProseMirrorDoc;

function catch_err(fn: () => unknown): SchemaUnknownError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(SchemaUnknownError);
    return e as SchemaUnknownError;
  }
  throw new Error("expected throw");
}

describe("assert_known_nodes", () => {
  it("unknown_node", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [{ type: "embed" }, { type: "video" }, { type: "embed" }],
    };
    const before = structuredClone(doc);
    const err = catch_err(() => assert_known_nodes(doc, 1));
    expect(err.unknown_nodes).toEqual(["embed", "video"]);
    expect(err.lesson_id).toBeNull();
    expect(doc).toEqual(before);
  });

  it("unknown_mark", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "underline" }] },
          ],
        },
      ],
    };
    expect(catch_err(() => assert_known_nodes(doc, 1)).unknown_nodes).toContain(
      "underline",
    );
  });

  it("unknown_version", () => {
    const err = catch_err(() => assert_known_nodes(reading, 2));
    expect(err.schema_version).toBe(2);
    expect(err.unknown_nodes).toEqual([]);
    expect(err.message).toContain("2");
  });

  it("ok_counts_nodes", () => {
    const before = structuredClone(reading);
    const count = (d: ProseMirrorDoc): number =>
      1 + (d.content ?? []).reduce((a, c) => a + count(c), 0);
    const res = assert_known_nodes(reading, 1);
    expect(res).toEqual({
      ok: true,
      node_count: count(reading),
      schema_version: 1,
    });
    expect(reading).toEqual(before);
  });
});
