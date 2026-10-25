"use client";
import { EDITOR_SCHEMA } from "@ls/editor-schema/schema";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { redo, undo, yUndoPluginKey } from "y-prosemirror";
import { Button } from "@/components/ui/button";

type Command = (state: EditorState, dispatch?: EditorView["dispatch"]) => boolean;

const { nodes, marks } = EDITOR_SCHEMA;

function mark_active(state: EditorState, mark: NonNullable<(typeof marks)[string]>): boolean {
  const { from, $from, to, empty } = state.selection;
  return empty ? !!mark.isInSet(state.storedMarks || $from.marks()) : state.doc.rangeHasMark(from, to, mark);
}

function in_node(state: EditorState, name: string): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 0; d--) if ($from.node(d).type.name === name) return true;
  return false;
}

interface Item {
  label: string;
  visible: string;
  run?: Command;
  active?: (s: EditorState) => boolean;
  unsupported?: string;
}

const ITEMS: Item[] = [
  { label: "Paragraph", visible: "¶ Paragraph", run: setBlockType(nodes.paragraph!), active: (s) => s.selection.$from.parent.type === nodes.paragraph },
  { label: "Bold", visible: "B", run: toggleMark(marks.strong!), active: (s) => mark_active(s, marks.strong!) },
  { label: "Italic", visible: "I", run: toggleMark(marks.em!), active: (s) => mark_active(s, marks.em!) },
  { label: "Underline", visible: "U", unsupported: "Underline isn't part of the lesson format" },
  { label: "Bulleted list", visible: "• List", run: wrapInList(nodes.bullet_list!), active: (s) => in_node(s, "bullet_list") },
  { label: "Numbered list", visible: "1. List", run: wrapInList(nodes.ordered_list!), active: (s) => in_node(s, "ordered_list") },
  { label: "Link", visible: "Link", unsupported: "Links aren't part of the lesson format" },
  { label: "Teacher talk", visible: "Teacher talk", run: toggleMark(marks.teacher_talk!), active: (s) => mark_active(s, marks.teacher_talk!) },
  { label: "Sample response", visible: "Sample response", run: toggleMark(marks.sample_response!), active: (s) => mark_active(s, marks.sample_response!) },
];

function stack_sizes(view: EditorView): { undo: number; redo: number } {
  const um = (yUndoPluginKey.getState(view.state) as { undoManager?: { undoStack: unknown[]; redoStack: unknown[] } } | undefined)?.undoManager;
  return { undo: um?.undoStack.length ?? 0, redo: um?.redoStack.length ?? 0 };
}

/** `tick` changes on every transaction so the active states re-render. */
export function Toolbar({ view }: { view: EditorView | null; tick: number }) {
  if (!view) return null;
  const sizes = stack_sizes(view);
  const keep_focus = (e: React.MouseEvent) => e.preventDefault();
  const run = (cmd: Command) => {
    cmd(view.state, view.dispatch);
    view.focus();
  };
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1">
      {ITEMS.map((it) =>
        it.unsupported ? (
          <Button key={it.label} variant="ghost" size="sm" disabled aria-label={it.label} title={it.unsupported}>
            {it.visible}
          </Button>
        ) : (
          <Button
            key={it.label}
            variant="ghost"
            size="sm"
            aria-label={it.label}
            aria-pressed={it.active ? it.active(view.state) : undefined}
            onMouseDown={keep_focus}
            onClick={() => run(it.run!)}
          >
            {it.visible}
          </Button>
        ),
      )}
      <Button variant="ghost" size="sm" aria-label="Undo" disabled={sizes.undo === 0} onMouseDown={keep_focus} onClick={() => run((s) => undo(s))}>
        Undo
      </Button>
      <Button variant="ghost" size="sm" aria-label="Redo" disabled={sizes.redo === 0} onMouseDown={keep_focus} onClick={() => run((s) => redo(s))}>
        Redo
      </Button>
    </div>
  );
}
