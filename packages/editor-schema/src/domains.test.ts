import { describe, expect, it } from "vitest";
import { EDITOR_SCHEMA } from "./schema.ts";

const para = {
  type: "paragraph",
  attrs: { align: null },
  content: [{ type: "text", text: "x" }],
};
const doc = (...content: unknown[]) => ({ type: "doc", content });
const build = (j: unknown) => EDITOR_SCHEMA.nodeFromJSON(j).check();

describe("attribute and content domains", () => {
  const cases: [string, unknown][] = [
    [
      "heading level 6",
      doc({
        type: "heading",
        attrs: { level: 6 },
        content: [{ type: "text", text: "x" }],
      }),
    ],
    [
      "routine_heading icon x",
      doc({
        type: "routine_heading",
        attrs: { icon: "x" },
        content: [{ type: "text", text: "x" }],
      }),
    ],
    [
      "callout variant loud",
      doc({ type: "callout", attrs: { variant: "loud" }, content: [para] }),
    ],
    [
      "excerpt_slot rights free",
      doc({
        type: "excerpt_slot",
        attrs: { slot_id: "a", rights: "free", source_ref: null },
      }),
    ],
    [
      "quote rights free",
      doc({
        type: "quote",
        attrs: { slot_id: "a", source_ref: "x", rights: "free" },
        content: [{ type: "text", text: "x" }],
      }),
    ],
    [
      "quote with a strong mark",
      doc({
        type: "quote",
        attrs: { slot_id: "a", source_ref: "x", rights: "licensed" },
        content: [{ type: "text", text: "x", marks: [{ type: "strong" }] }],
      }),
    ],
    [
      "quote without slot_id",
      doc({ type: "quote", content: [{ type: "text", text: "x" }] }),
    ],
    [
      "quote holding a paragraph",
      doc({
        type: "quote",
        attrs: { slot_id: "a" },
        content: [para],
      }),
    ],
    [
      "ordered_list type z",
      doc({
        type: "ordered_list",
        attrs: { order: 1, type: "z" },
        content: [{ type: "list_item", content: [para] }],
      }),
    ],
    [
      "teacher_tip inside table_cell",
      doc({
        type: "table",
        content: [
          {
            type: "table_row",
            content: [
              {
                type: "table_cell",
                attrs: { colspan: 1, rowspan: 1, colwidth: null },
                content: [
                  {
                    type: "teacher_tip",
                    attrs: { safety_note_id: null },
                    content: [para],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ],
  ];
  for (const [name, json] of cases) {
    it(`rejects ${name}`, () => {
      let err: unknown;
      try {
        build(json);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(RangeError);
      expect((err as Error).message.length).toBeGreaterThan(0);
    });
  }
});

describe("quote node (NL-46)", () => {
  it("accepts a plain-text quote with a source string and a rights status", () => {
    const json = doc({
      type: "quote",
      attrs: {
        slot_id: "slot-a",
        source_ref: '{"title":"Synthetic"}',
        rights: "to-clear",
        origin: null,
      },
      content: [{ type: "text", text: "<b>kept verbatim</b>" }],
    });
    expect(() => build(json)).not.toThrow();
    expect(EDITOR_SCHEMA.nodeFromJSON(json).toJSON()).toEqual(json);
  });
  it("defaults source_ref to a blank string and rights to unset", () => {
    const n = EDITOR_SCHEMA.nodes["quote"]!.create({ slot_id: "s" });
    expect(n.attrs).toEqual({ slot_id: "s", source_ref: "", rights: "unset", origin: null });
  });
});
