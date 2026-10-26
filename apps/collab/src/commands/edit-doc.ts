// Pure Yjs mutations for apply_edit. prepare_edit resolves and validates against the document first (throwing
// DomainRefusal and touching nothing), then returns the mutator to run inside the one tagged transaction.
import * as Y from "yjs";
import { prosemirrorJSONToYXmlFragment } from "y-prosemirror";
import { DomainRefusal } from "@ls/core/errors";
import type { LessonEdit, SlotFillEdit, StandardEdit, AdoptEdit, SuggestionAcceptEdit } from "@ls/core/ports/collab-commands";
import { EDITOR_SCHEMA } from "@ls/editor-schema/schema";
import type { Standard, StoredLesson } from "@ls/schema/lesson";

export interface EditPrefetch {
  candidate: StoredLesson | null;
  standard_text: { code: string; official_text: string } | null;
}

const SLOT_NODES = new Set(["quote_placeholder", "excerpt_slot", "quote"]);
const not_found = (what: string) => new DomainRefusal("NOT_FOUND", `${what} not found`, {});
const anchor_changed = () => new DomainRefusal("ANCHOR_CHANGED", "The text under the suggestion changed", {});

export function edit_doc(doc: Y.Doc, edit: LessonEdit, pre: EditPrefetch): void {
  prepare_edit(doc, edit, pre)();
}

export function prepare_edit(doc: Y.Doc, edit: LessonEdit, pre: EditPrefetch): () => void {
  switch (edit.kind) {
    case "standard":
      return prepare_standard(doc, edit, pre);
    case "slot_fill":
      return prepare_slot_fill(doc, edit);
    case "adopt":
      return prepare_adopt(doc, edit, pre);
    case "suggestion_accept":
      return prepare_accept(doc, edit);
  }
}

function prepare_standard(doc: Y.Doc, edit: StandardEdit, pre: EditPrefetch): () => void {
  const fm = doc.getMap("front_matter");
  const list = ((fm.get("standards") as Standard[] | undefined) ?? []).slice();
  const at = list.findIndex((s) => s.code === edit.code);
  const set = (next: Standard[]) => () => void fm.set("standards", next);
  switch (edit.decision) {
    case "confirm":
    case "remove": {
      if (at < 0) throw not_found("Standard");
      const confirmation = edit.decision === "confirm" ? "confirmed" : "removed";
      return set(list.map((s, i) => (i === at ? { ...s, confirmation } : s)));
    }
    case "add": {
      if (at >= 0) return set(list.map((s, i) => (i === at ? { ...s, confirmation: "open" } : s)));
      if (pre.standard_text === null || pre.standard_text.code !== edit.code) throw not_found("Standard");
      const added: Standard = {
        code: edit.code, role: "supporting", origin: "added", official_text: pre.standard_text.official_text,
        asserted_by: "reviewer", confirmation: "open",
      };
      return set([...list, added]);
    }
    case "undo": {
      if (edit.restore === null) return set(list.filter((s) => s.code !== edit.code));
      const restored = structuredClone(edit.restore);
      return set(at >= 0 ? list.map((s, i) => (i === at ? restored : s)) : [...list, restored]);
    }
  }
}

function addresses(doc: Y.Doc): string[] {
  return (doc.getArray<string | string[]>("section_order").toArray() as (string | string[])[]).flat();
}

function find_slot(parent: Y.XmlFragment, slot_id: string): { parent: Y.XmlFragment; index: number } | null {
  for (let i = 0; i < parent.length; i++) {
    const child = parent.get(i);
    if (child instanceof Y.XmlElement) {
      if (SLOT_NODES.has(child.nodeName) && child.getAttribute("slot_id") === slot_id) return { parent, index: i };
      const inner = find_slot(child, slot_id);
      if (inner !== null) return inner;
    }
  }
  return null;
}

function prepare_slot_fill(doc: Y.Doc, edit: SlotFillEdit): () => void {
  let hit: { parent: Y.XmlFragment; index: number } | null = null;
  for (const a of addresses(doc)) {
    hit = find_slot(doc.getXmlFragment("section:" + a), edit.slot_id);
    if (hit !== null) break;
  }
  if (hit === null) throw not_found("Slot");
  const { parent, index } = hit;
  const replaced = parent.get(index);
  const prior = replaced instanceof Y.XmlElement ? replaced : null;
  // Remember which slot node this became a quote from, so the `.excerpt-N` ordinal still counts only excerpt slots.
  const origin = prior === null ? null : prior.nodeName === "quote" ? (prior.getAttribute("origin") ?? null) : prior.nodeName;
  return () => {
    const el = new Y.XmlElement("quote");
    if (origin !== null) el.setAttribute("origin", origin);
    el.setAttribute("slot_id", edit.slot_id);
    el.setAttribute("source_ref", JSON.stringify(edit.source_ref)); // "" would mean unsourced; a SourceRef is never "{}"-empty (title is required)
    el.setAttribute("rights", edit.rights_status);
    el.insert(0, [new Y.XmlText(edit.text)]);
    parent.delete(index, 1);
    parent.insert(index, [el]);
  };
}

function prepare_adopt(doc: Y.Doc, edit: AdoptEdit, pre: EditPrefetch): () => void {
  const cand = pre.candidate;
  if (cand === null) throw not_found("Candidate");
  const here = addresses(doc);
  let targets: string[];
  if (edit.scope === "section") {
    const a = edit.section_address;
    if (a === null || !here.includes(a) || !cand.sections.some((s) => s.address === a)) throw not_found("Section");
    targets = [a];
  } else {
    targets = here.filter((a) => cand.sections.some((s) => s.address === a));
  }
  return () => {
    const meta = doc.getMap("section_meta");
    for (const a of targets) {
      const s = cand.sections.find((x) => x.address === a)!;
      const frag = doc.getXmlFragment("section:" + a);
      frag.delete(0, frag.length);
      prosemirrorJSONToYXmlFragment(EDITOR_SCHEMA, s.content, frag);
      meta.set(a, { name: s.name, minutes: s.minutes });
    }
  };
}

function decode_pos(b64: string, doc: Y.Doc): Y.AbsolutePosition | null {
  try {
    return Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(Buffer.from(b64, "base64")), doc);
  } catch {
    return null;
  }
}

function prepare_accept(doc: Y.Doc, edit: SuggestionAcceptEdit): () => void {
  const start = decode_pos(edit.anchor.start, doc);
  const end = decode_pos(edit.anchor.end, doc);
  if (start === null || end === null || start.type !== end.type || !(start.type instanceof Y.XmlText) || end.index < start.index) {
    throw anchor_changed();
  }
  const text = start.type;
  const delta = text.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[];
  const whole = delta.map((d) => (typeof d.insert === "string" ? d.insert : "")).join("");
  if (whole.slice(start.index, end.index) !== edit.expected_text) throw anchor_changed();
  let attrs: Record<string, unknown> | undefined;
  let pos = 0;
  for (const d of delta) {
    const len = typeof d.insert === "string" ? d.insert.length : 1;
    if (start.index < pos + len) {
      attrs = d.attributes;
      break;
    }
    pos += len;
  }
  return () => {
    text.delete(start.index, end.index - start.index);
    text.insert(start.index, edit.replacement_text, attrs);
  };
}
