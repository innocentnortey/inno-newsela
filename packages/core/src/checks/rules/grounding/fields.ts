import type { PMNode } from "@ls/schema/lesson";
import type { CheckContext } from "../../types.ts";
import {
  find_cfu_items,
  visit_with_parts,
  walk,
} from "../structural/doc-walk.ts";

export type TextField = {
  address: string;
  text: string;
  in_cfu_choice: boolean;
};
export type SlotNode = { node: PMNode; address: string };
export type Collected = {
  fields: TextField[];
  placeholders: SlotNode[];
  excerpts: SlotNode[];
  quotes: SlotNode[];
};

const TEXT_TYPES = new Set(["paragraph", "heading", "routine_heading"]);

/** Inline text of a block: text children joined, a hard break as one space. */
function inline_text(node: PMNode): string {
  let out = "";
  for (const c of node.content ?? []) {
    if (typeof c.text === "string") out += c.text;
    else if (c.type === "hard_break") out += " ";
    else out += inline_text(c);
  }
  return out;
}

function descendants(nodes: PMNode[], into: Set<PMNode>): void {
  for (const n of nodes) walk(n, (x) => into.add(x));
}

export function collect(ctx: CheckContext): Collected {
  const out: Collected = {
    fields: [],
    placeholders: [],
    excerpts: [],
    quotes: [],
  };
  for (const section of ctx.lesson.sections) {
    // Options and rationales of each CFU item (the stem, blocks[0], is not one).
    const cfu_choice = new Set<PMNode>();
    for (const item of find_cfu_items(section)) {
      descendants(item.blocks.slice(1), cfu_choice);
    }
    const inside_quote = new Set<PMNode>();
    for (const n of section.content.content ?? []) {
      walk(n, (x) => {
        if (x.type === "quote") descendants(x.content ?? [], inside_quote);
      });
    }
    visit_with_parts(section, ({ node, address }) => {
      if (TEXT_TYPES.has(node.type)) {
        if (inside_quote.has(node)) return;
        out.fields.push({
          address,
          text: inline_text(node),
          in_cfu_choice: cfu_choice.has(node),
        });
      } else if (node.type === "quote_placeholder") {
        out.placeholders.push({ node, address });
      } else if (node.type === "excerpt_slot") {
        out.excerpts.push({ node, address });
      } else if (node.type === "quote") {
        out.quotes.push({ node, address });
      }
    });
  }
  return out;
}
