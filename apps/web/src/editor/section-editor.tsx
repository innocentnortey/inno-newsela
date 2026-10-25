"use client";
// One ProseMirror view per section, bound to Y.XmlFragment "section:<address>". Schema = EDITOR_SCHEMA only (R-58).
import { EDITOR_SCHEMA } from "@ls/editor-schema/schema";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef } from "react";
import type { Awareness } from "y-protocols/awareness";
import { redo, undo, yCursorPlugin, ySyncPlugin, yUndoPlugin } from "y-prosemirror";
import type * as Y from "yjs";
import "./editor.css";

export interface SectionEditorProps {
  address: string;
  label: string;
  fragment: Y.XmlFragment;
  awareness: Awareness;
  editable: boolean;
  onFocus: (view: EditorView) => void;
  onTransaction: () => void;
  register: (address: string, view: EditorView | null) => void;
}

interface CursorUser { name: string; slot?: number }

function cursor_builder(user: CursorUser): HTMLElement {
  const caret = document.createElement("span");
  caret.className = "ls-caret";
  caret.setAttribute("data-presence-slot", String(user.slot ?? 1));
  const flag = document.createElement("span");
  flag.className = "ls-caret-flag";
  flag.textContent = user.name;
  caret.appendChild(flag);
  return caret;
}

function selection_builder(user: CursorUser) {
  return { class: "ls-selection", "data-presence-slot": String(user.slot ?? 1) };
}

export function SectionEditor(props: SectionEditorProps) {
  const { address, label, fragment, awareness, editable, register } = props;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const editable_ref = useRef(editable);
  const cb = useRef(props);
  editable_ref.current = editable;
  cb.current = props;

  useEffect(() => {
    const marks = EDITOR_SCHEMA.marks;
    const v = new EditorView(host.current!, {
      state: EditorState.create({
        schema: EDITOR_SCHEMA,
        plugins: [
          ySyncPlugin(fragment),
          yCursorPlugin(awareness, { cursorBuilder: cursor_builder, selectionBuilder: selection_builder }),
          yUndoPlugin(),
          keymap({
            "Mod-z": undo,
            "Mod-y": redo,
            "Shift-Mod-z": redo,
            "Mod-b": toggleMark(marks.strong!),
            "Mod-i": toggleMark(marks.em!),
          }),
          keymap(baseKeymap),
        ],
      }),
      editable: () => editable_ref.current,
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        "aria-readonly": String(!editable_ref.current),
        class: "ls-editor",
      },
      dispatchTransaction(this: EditorView, tr) {
        this.updateState(this.state.apply(tr));
        cb.current.onTransaction();
      },
      handleDOMEvents: {
        focus: () => {
          cb.current.onFocus(v);
          awareness.setLocalStateField("section", address);
          return false;
        },
      },
    });
    view.current = v;
    register(address, v);
    return () => {
      register(address, null);
      view.current = null;
      v.destroy();
    };
    // The view is created once per fragment/awareness; label and editability are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragment, awareness, address]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.setProps({
      editable: () => editable,
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        "aria-readonly": String(!editable),
        class: "ls-editor",
      },
    });
  }, [editable, label]);

  return <div ref={host} data-testid={`section-${address}`} />;
}
