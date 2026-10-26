import { Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";
import { SchemaUnknownError } from "./errors.ts";

export { SchemaUnknownError } from "./errors.ts";

export const SCHEMA_VERSION = 1 as const;

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export interface ProseMirrorDoc {
  type: string;
  attrs?: Record<string, JsonValue>;
  content?: ProseMirrorDoc[];
  marks?: { type: string; attrs?: Record<string, JsonValue> }[];
  text?: string;
}

export interface NodeCheck {
  ok: true;
  node_count: number;
  schema_version: number;
}

const ICONS = [
  "cfu",
  "notes_section",
  "writing",
  "graphic_organizer",
  "academic_discussion",
  "personal_dictionary",
  "reading",
] as const;
const VARIANTS = ["purpose", "say", "watch"] as const;
const RIGHTS = [
  "unset",
  "public-domain",
  "Newsela-owned",
  "licensed",
  "to-clear",
  "short-quote-commentary",
] as const;

function one_of(
  name: string,
  allowed: readonly string[],
): (v: unknown) => void {
  return (v) => {
    if (typeof v !== "string" || !allowed.includes(v)) {
      throw new RangeError(
        `${name} must be one of ${allowed.join(", ")}; got ${String(v)}`,
      );
    }
  };
}

function nullable_string(name: string): (v: unknown) => void {
  return (v) => {
    if (v !== null && typeof v !== "string")
      throw new RangeError(`${name} must be a string or null`);
  };
}

function block_dom(name: string): NodeSpec["toDOM"] {
  return () => ["div", { "data-node": name }, 0];
}

const nodes: Record<string, NodeSpec> = {
  doc: { content: "(block | teacher_block)+" },
  paragraph: {
    group: "block",
    content: "inline*",
    attrs: {
      align: {
        default: null,
        validate: (v: unknown) => {
          if (v !== null && v !== "center")
            throw new RangeError(`paragraph align must be null or center`);
        },
      },
    },
    toDOM: () => ["p", 0],
  },
  heading: {
    group: "block",
    content: "inline*",
    attrs: {
      level: {
        default: 1,
        validate: (v: unknown) => {
          if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
            throw new RangeError(
              `heading level must be an integer 1-5; got ${String(v)}`,
            );
          }
        },
      },
    },
    toDOM: block_dom("heading"),
  },
  bullet_list: {
    group: "block",
    content: "list_item+",
    toDOM: () => ["ul", 0],
  },
  ordered_list: {
    group: "block",
    content: "list_item+",
    attrs: {
      order: {
        default: 1,
        validate: (v: unknown) => {
          if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
            throw new RangeError(
              `ordered_list order must be a positive integer`,
            );
          }
        },
      },
      // Ticket NL-10: `A` marks lettered choices; null is the plain numbered list.
      type: {
        default: null,
        validate: (v: unknown) => {
          if (v !== null && v !== "A")
            throw new RangeError(`ordered_list type must be null or "A"`);
        },
      },
    },
    toDOM: () => ["ol", 0],
  },
  list_item: {
    content: "paragraph (block | teacher_block)*",
    toDOM: () => ["li", 0],
  },
  table: {
    group: "block",
    content: "table_row+",
    toDOM: () => ["table", ["tbody", 0]],
  },
  table_row: {
    content: "(table_cell | table_header)+",
    toDOM: () => ["tr", 0],
  },
  table_cell: {
    content: "block+",
    attrs: {
      colspan: { default: 1, validate: "number" },
      rowspan: { default: 1, validate: "number" },
      colwidth: {
        default: null,
        validate: (v: unknown) => {
          if (
            v !== null &&
            !(Array.isArray(v) && v.every((n) => typeof n === "number"))
          ) {
            throw new RangeError(`colwidth must be null or number[]`);
          }
        },
      },
    },
    toDOM: () => ["td", 0],
  },
  table_header: {
    content: "block+",
    attrs: {
      colspan: { default: 1, validate: "number" },
      rowspan: { default: 1, validate: "number" },
      colwidth: {
        default: null,
        validate: (v: unknown) => {
          if (
            v !== null &&
            !(Array.isArray(v) && v.every((n) => typeof n === "number"))
          ) {
            throw new RangeError(`colwidth must be null or number[]`);
          }
        },
      },
    },
    toDOM: () => ["th", 0],
  },
  routine_heading: {
    group: "block",
    content: "inline*",
    attrs: {
      icon: { default: "cfu", validate: one_of("routine_heading icon", ICONS) },
    },
    toDOM: block_dom("routine_heading"),
  },
  callout: {
    group: "block",
    content: "(block | teacher_block)+",
    attrs: {
      variant: {
        default: "purpose",
        validate: one_of("callout variant", VARIANTS),
      },
    },
    toDOM: block_dom("callout"),
  },
  collapsible: {
    group: "block",
    content: "(block | teacher_block)+",
    attrs: { label: { default: "", validate: "string" } },
    toDOM: block_dom("collapsible"),
  },
  teacher_tip: {
    group: "teacher_block",
    content: "block+",
    attrs: {
      safety_note_id: {
        default: null,
        validate: nullable_string("safety_note_id"),
      },
    },
    toDOM: block_dom("teacher_tip"),
  },
  quote_placeholder: {
    group: "block",
    atom: true,
    attrs: {
      slot_id: { validate: "string" },
      reason: { default: "", validate: "string" },
    },
    toDOM: block_dom("quote_placeholder"),
  },
  excerpt_slot: {
    group: "block",
    atom: true,
    attrs: {
      slot_id: { validate: "string" },
      rights: {
        default: "unset",
        validate: one_of("excerpt_slot rights", RIGHTS),
      },
      source_ref: { default: null, validate: nullable_string("source_ref") },
    },
    toDOM: block_dom("excerpt_slot"),
  },
  // Added with NL-46 (CON-15 fillSlot): the node a reviewer's fill inserts. Plain text only (R-58).
  quote: {
    group: "block",
    content: "text*",
    marks: "",
    attrs: {
      slot_id: { validate: "string" },
      source_ref: { default: "", validate: "string" },
      rights: { default: "unset", validate: one_of("quote rights", RIGHTS) },
      // The slot node type this quote replaced (GEN-3 review): lets the `.excerpt-N` ordinal count only excerpt slots.
      origin: { default: null, validate: nullable_string("origin") },
    },
    toDOM: block_dom("quote"),
  },
  text: { group: "inline" },
  hard_break: {
    group: "inline",
    inline: true,
    selectable: false,
    toDOM: () => ["br"],
  },
};

const marks: Record<string, MarkSpec> = {
  strong: { toDOM: () => ["strong", 0] },
  em: { toDOM: () => ["em", 0] },
  teacher_talk: { toDOM: () => ["span", { "data-role": "teacher_talk" }, 0] },
  sample_response: {
    toDOM: () => ["span", { "data-role": "sample_response" }, 0],
  },
};

export const EDITOR_SCHEMA = new Schema({ nodes, marks });

export const NODE_NAMES: readonly string[] = Object.keys(nodes);
export const MARK_NAMES: readonly string[] = Object.keys(marks);

/** Pure walk over ProseMirror JSON: rejects unknown node/mark names or schema versions. Never mutates input. */
export function assert_known_nodes(
  doc: ProseMirrorDoc,
  schema_version: number,
): NodeCheck {
  if (schema_version !== SCHEMA_VERSION) {
    throw new SchemaUnknownError({
      lesson_id: null,
      schema_version,
      unknown_nodes: [],
    });
  }
  const unknown: string[] = [];
  let count = 0;
  const note = (name: string, known: readonly string[]): void => {
    if (!known.includes(name) && !unknown.includes(name)) unknown.push(name);
  };
  const walk = (n: ProseMirrorDoc): void => {
    count += 1;
    note(n.type, NODE_NAMES);
    for (const m of n.marks ?? []) note(m.type, MARK_NAMES);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  if (unknown.length > 0) {
    throw new SchemaUnknownError({
      lesson_id: null,
      schema_version,
      unknown_nodes: unknown,
    });
  }
  return { ok: true, node_count: count, schema_version: SCHEMA_VERSION };
}
