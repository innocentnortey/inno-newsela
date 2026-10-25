"use client";
// Dev-only: the collab mock keeps no persistence (a doc is dropped when its last connection leaves), so a hidden
// connection seeds two synthetic sections and stays open for the page's lifetime.
import { EDITOR_SCHEMA } from "@ls/editor-schema/schema";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { prosemirrorJSONToYXmlFragment } from "y-prosemirror";
import type * as Y from "yjs";

export function start_seed(url: string, doc_id: string): () => void {
  const provider = new HocuspocusProvider({
    url,
    name: `lesson:${doc_id}`,
    token: "session-cookie",
    onSynced: () => seed(provider.document, doc_id),
  });
  return () => provider.destroy();
}

function seed(doc: Y.Doc, doc_id: string): void {
  const order = doc.getArray<string>("section_order");
  if (order.length > 0) return;
  doc.transact(() => {
    const meta = doc.getMap("section_meta");
    for (const [key, name] of [["PartA", "Part A"], ["PartB", "Part B"]] as const) {
      const address = `${doc_id}.LearningInAction.${key}`;
      order.push([address]);
      meta.set(address, { name, minutes: 15 });
      prosemirrorJSONToYXmlFragment(
        EDITOR_SCHEMA,
        { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Synthetic ${name} text.` }] }] },
        doc.getXmlFragment(`section:${address}`),
      );
    }
  });
}
