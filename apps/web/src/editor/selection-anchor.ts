// NL-116: turn the reviewer's ProseMirror selection into a CON-17 anchor: the selected text plus two Yjs relative
// positions (base64). The collaboration server decodes them with Y.decodeRelativePosition and refuses (ANCHOR_CHANGED)
// unless both land in the same Y.XmlText and the text between them equals the stored selected text. So this helper
// returns null (the panel then shows "Select some text in the lesson first.") for anything the server would refuse:
// empty selection, more than one paragraph, over 2,000 characters, or a range that does not resolve to one text run.
import type { EditorView } from "prosemirror-view";
import { absolutePositionToRelativePosition, ySyncPluginKey } from "y-prosemirror";
import * as Y from "yjs";
import type { AssistSelection } from "@/features/assist/use-suggestions";

export const ASSIST_MAX_SELECTION = 2000;

function encode(rel: Y.RelativePosition): string {
  let bin = "";
  for (const b of Y.encodeRelativePosition(rel)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function selectionAnchor(view: EditorView): AssistSelection | null {
  const { from, to, empty } = view.state.selection;
  if (empty) return null;
  const doc = view.state.doc;
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  if (!$from.parent.isTextblock || !$from.sameParent($to)) return null;
  const text = doc.textBetween(from, to);
  if (text.trim() === "" || text.length > ASSIST_MAX_SELECTION) return null;

  const sync = ySyncPluginKey.getState(view.state) as { type?: Y.XmlFragment; binding?: { mapping: Map<never, never> } } | undefined;
  if (!sync?.type || !sync.binding || !sync.type.doc) return null;
  const ydoc = sync.type.doc;
  const start = absolutePositionToRelativePosition(from, sync.type, sync.binding.mapping);
  const end = absolutePositionToRelativePosition(to, sync.type, sync.binding.mapping);

  // The same check the collaboration server makes, so a selection it would refuse never reaches the model.
  const a = Y.createAbsolutePositionFromRelativePosition(start, ydoc);
  const b = Y.createAbsolutePositionFromRelativePosition(end, ydoc);
  if (a === null || b === null || a.type !== b.type || !(a.type instanceof Y.XmlText) || b.index < a.index) return null;
  const delta = a.type.toDelta() as { insert: unknown }[];
  const whole = delta.map((d) => (typeof d.insert === "string" ? d.insert : "")).join("");
  if (whole.slice(a.index, b.index) !== text) return null;

  return { text, anchor: { start: encode(start), end: encode(end) } };
}
