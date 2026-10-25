import type { components } from "@/lib/api-types";

type Issue = components["schemas"]["Issue"];
type Sections = components["schemas"]["Lesson"]["sections"];

export const SLOT_KINDS: readonly Issue["kind"][] = ["quote_placeholder_open", "excerpt_slot_open", "rights_to_clear"];

const NODE_TYPES: Partial<Record<Issue["kind"], string>> = {
  quote_placeholder_open: "quote_placeholder",
  excerpt_slot_open: "excerpt_slot",
  rights_to_clear: "quote",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Slot ids of the nodes of one type, in document order (same traversal as find-slot.ts). */
function slotIds(node: unknown, type: string, out: string[]): string[] {
  if (!isRecord(node)) return out;
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  if (node.type === type && typeof attrs.slot_id === "string") out.push(attrs.slot_id);
  if (Array.isArray(node.content)) for (const child of node.content as unknown[]) slotIds(child, type, out);
  return out;
}

/**
 * The slot an open slot issue points at. Issue carries no slot id (seam S-31), so the section at `issue.address` is
 * walked: with several slot issues of one kind in that section, the nth open issue maps to the nth slot node.
 * null means no button (never a guessed id).
 */
export function slotIdFor(issue: Issue, sections: Sections, openSlotIssues: readonly Issue[]): string | null {
  const type = NODE_TYPES[issue.kind];
  if (!type || !issue.address) return null;
  const section = sections.find((s) => s.address === issue.address);
  if (!section) return null;
  const ids = slotIds(section.content, type, []);
  if (ids.length === 0) return null;
  const mentioned = /slot_id[=:\s"']+([\w.:-]+)/.exec(issue.message)?.[1];
  if (mentioned && ids.includes(mentioned)) return mentioned;
  const peers = openSlotIssues.filter((i) => i.kind === issue.kind && i.address === issue.address);
  const n = peers.findIndex((i) => i.issue_id === issue.issue_id);
  return ids[n < 0 ? 0 : n] ?? null;
}
