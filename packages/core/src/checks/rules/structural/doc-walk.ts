import type { PMNode, Section } from "@ls/schema/lesson";
import { parse_rationale_label } from "../../../compile/labels.ts";
import type { RationaleLabel } from "../../../compile/labels.ts";

export function walk(node: PMNode, fn: (n: PMNode) => void): void {
  fn(node);
  for (const child of node.content ?? []) walk(child, fn);
}

export function node_text(node: PMNode): string {
  let out = "";
  walk(node, (n) => {
    if (typeof n.text === "string") out += n.text;
  });
  return out;
}

export function section_nodes(section: Section): PMNode[] {
  return section.content.content ?? [];
}

const PART_RE = /^Part\s+([A-Z])$/;

export function part_address(section: Section, heading: PMNode): string {
  const m = PART_RE.exec(node_text(heading).trim());
  return m === null ? section.address : `${section.address}.Part${m[1]}`;
}

export type SectionEvent = {
  node: PMNode;
  address: string;
  siblings: PMNode[];
  index: number;
};

/**
 * Visit every node in document order with the current part address.
 * `siblings`/`index` locate the node inside its container; collapsibles are descended.
 */
export function visit_with_parts(
  section: Section,
  fn: (e: SectionEvent) => void,
): void {
  let address = section.address;
  const go = (siblings: PMNode[]): void => {
    siblings.forEach((node, index) => {
      if (node.type === "heading" && node.attrs?.level === 2) {
        address = part_address(section, node);
      }
      fn({ node, address, siblings, index });
      if (node.content !== undefined && node.type !== "paragraph")
        go(node.content);
    });
  };
  go(section_nodes(section));
}

export type CfuItem = { address: string; heading: PMNode; blocks: PMNode[] };

const PULSE_RE = /^Pulse Check(?: \(.+\))?$/;

/** A CFU item runs from its cfu routine_heading to the next routine_heading or heading sibling. */
export function find_cfu_items(section: Section): CfuItem[] {
  const items: CfuItem[] = [];
  visit_with_parts(section, ({ node, address, siblings, index }) => {
    if (node.type !== "routine_heading" || node.attrs?.icon !== "cfu") return;
    if (!PULSE_RE.test(node_text(node).trim())) return;
    const blocks: PMNode[] = [];
    for (let i = index + 1; i < siblings.length; i += 1) {
      const s = siblings[i];
      if (
        s === undefined ||
        s.type === "routine_heading" ||
        s.type === "heading"
      )
        break;
      blocks.push(s);
    }
    items.push({ address, heading: node, blocks });
  });
  return items;
}

export type CfuParts = {
  /** Blocks before the lettered list (all blocks when there is no lettered list). */
  stem: PMNode[];
  /** First ordered_list with attrs.type === "A". */
  list: PMNode | undefined;
  /** Paragraphs after the list that parse_rationale_label accepts. */
  rationales: { node: PMNode; label: RationaleLabel }[];
  /** Every other block after the list. */
  extra: PMNode[];
};

/** The one reading of a CFU item's layout; schema_invalid (teacher view) and student-blocks (student view) share it. */
export function cfu_parts(item: CfuItem): CfuParts {
  const list = item.blocks.find((b) => b.type === "ordered_list" && b.attrs?.type === "A");
  if (list === undefined) return { stem: item.blocks, list: undefined, rationales: [], extra: [] };
  const at = item.blocks.indexOf(list);
  const rationales: CfuParts["rationales"] = [];
  const extra: PMNode[] = [];
  for (const b of item.blocks.slice(at + 1)) {
    const label = b.type === "paragraph" ? parse_rationale_label(node_text(b)) : null;
    if (label !== null) rationales.push({ node: b, label });
    else extra.push(b);
  }
  return { stem: item.blocks.slice(0, at), list, rationales, extra };
}
