import type { components } from "@/lib/api-types";
import { isOfferedRights, type OfferedRights } from "./rights";

type Lesson = components["schemas"]["Lesson"];

export interface SlotInfo {
  kind: "quote" | "excerpt";
  address: string;
  ask: string;
  rights: OfferedRights;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function match(node: unknown, slotId: string): Omit<SlotInfo, "address"> | null {
  if (!isRecord(node)) return null;
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  if (attrs.slot_id === slotId) {
    if (node.type === "quote_placeholder") {
      const reason = typeof attrs.reason === "string" && attrs.reason ? attrs.reason : "Reviewer to insert a quote here.";
      return { kind: "quote", ask: reason, rights: "short-quote-commentary" };
    }
    if (node.type === "excerpt_slot") {
      return {
        kind: "excerpt",
        ask: "Reviewer to insert the excerpt for this slot.",
        rights: isOfferedRights(attrs.rights) ? attrs.rights : "public-domain",
      };
    }
    if (node.type === "quote") return { kind: "quote", ask: "Replaces the quote now in this slot.", rights: "short-quote-commentary" };
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content as unknown[]) {
      const m = match(child, slotId);
      if (m) return m;
    }
  }
  return null;
}

export function findSlot(sections: Lesson["sections"], slotId: string): SlotInfo | null {
  for (const section of sections) {
    const m = match(section.content, slotId);
    if (m) return { ...m, address: section.address };
  }
  return null;
}

