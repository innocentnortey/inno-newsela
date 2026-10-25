// NL-116: the editor selection becomes a CON-17 anchor that the collaboration server's decoder accepts.
import { EDITOR_SCHEMA } from "@ls/editor-schema/schema";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ySyncPlugin } from "y-prosemirror";
import * as Y from "yjs";
import { afterEach, describe, expect, it } from "vitest";
import { selectionAnchor } from "@/editor/selection-anchor";

const views: EditorView[] = [];
afterEach(() => {
  while (views.length) views.pop()!.destroy();
});

// A paragraph's text lives in one Y.XmlText; marks are attributes on runs inside it.
const paragraph = (...runs: [string, Record<string, unknown>?][]) => ({ runs });
type Para = ReturnType<typeof paragraph>;

async function mount(...paras: Para[]) {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("section:x");
  // Insert the nodes first, then the runs: formatting on a type that is not yet in a doc is dropped.
  const elements = paras.map(() => new Y.XmlElement("paragraph"));
  frag.insert(0, elements);
  elements.forEach((p, n) => {
    const t = new Y.XmlText();
    p.insert(0, [t]);
    let i = 0;
    for (const [text, attrs] of paras[n]!.runs) {
      t.insert(i, text, attrs);
      i += text.length;
    }
  });
  const view = new EditorView(document.createElement("div"), {
    state: EditorState.create({ schema: EDITOR_SCHEMA, plugins: [ySyncPlugin(frag)] }),
  });
  views.push(view);
  await new Promise((r) => setTimeout(r, 20));
  return { view, doc };
}

const select = (view: EditorView, from: number, to: number) =>
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).setMeta("addToHistory", false));

// What apps/collab/src/commands/edit-doc.ts does with an anchor.
function collab_decode(b64: string, doc: Y.Doc) {
  return Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(Buffer.from(b64, "base64")), doc);
}

describe("selectionAnchor (NL-116)", () => {
  it("anchor round-trips through the collab decoder", async () => {
    const { view, doc } = await mount(paragraph(["Connection to Today's Learning and more."]));
    select(view, 1, 28);
    const sel = selectionAnchor(view);
    expect(sel?.text).toBe("Connection to Today's Learn");
    const a = collab_decode(sel!.anchor!.start, doc)!;
    const b = collab_decode(sel!.anchor!.end, doc)!;
    expect(a.type).toBe(b.type);
    expect(a.type).toBeInstanceOf(Y.XmlText);
    expect((a.type as Y.XmlText).toString().length).toBeGreaterThan(0);
    const whole = (a.type as Y.XmlText).toDelta().map((d: { insert: string }) => d.insert).join("");
    expect(whole.slice(a.index, b.index)).toBe(sel!.text);
  });

  it("empty selection returns null", async () => {
    const { view } = await mount(paragraph(["Hello world"]));
    select(view, 3, 3);
    expect(selectionAnchor(view)).toBeNull();
  });

  it("selection over two paragraphs returns null", async () => {
    const { view } = await mount(paragraph(["First one"]), paragraph(["Second one"]));
    select(view, 3, 16);
    expect(selectionAnchor(view)).toBeNull();
  });

  it("selection over 2001 chars returns null", async () => {
    const { view } = await mount(paragraph(["a".repeat(2500)]));
    select(view, 1, 2001);
    expect(selectionAnchor(view)?.text.length).toBe(2000);
    select(view, 1, 2002);
    expect(selectionAnchor(view)).toBeNull();
  });

  it("selection crossing a bold mark still anchors: marks are attributes inside one text run", async () => {
    const { view, doc } = await mount(paragraph(["plain  tail"]));
    // Bold the middle through ProseMirror, the way a reviewer would; y-prosemirror writes it to the Y.Doc.
    view.dispatch(view.state.tr.addMark(7, 10, EDITOR_SCHEMA.marks.strong!.create()));
    select(view, 3, 11);
    const sel = selectionAnchor(view);
    expect(sel).not.toBeNull();
    const a = collab_decode(sel!.anchor!.start, doc)!;
    const b = collab_decode(sel!.anchor!.end, doc)!;
    expect(a.type).toBe(b.type);
    const whole = (a.type as Y.XmlText).toDelta().map((d: { insert: string }) => d.insert).join("");
    expect(whole.slice(a.index, b.index)).toBe(sel!.text);
  });
});
