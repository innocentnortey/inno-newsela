"use client";
import { EDITOR_SCHEMA } from "@ls/editor-schema/schema";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { redo, undo, yUndoPluginKey } from "y-prosemirror";
import { cn } from "@/lib/cn";

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
  visible: React.ReactNode;
  run?: Command;
  active?: (s: EditorState) => boolean;
  unsupported?: string;
  /** Wider text chip (Paragraph, Teacher talk, Sample response) instead of a square icon button. */
  wide?: boolean;
  /** A separator goes before this item. */
  group?: boolean;
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const LIST = <Svg><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.8" cy="6" r=".9" /><circle cx="4.8" cy="12" r=".9" /><circle cx="4.8" cy="18" r=".9" /></Svg>;
const NUMBERED = <Svg><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5h1.5v4M4 9h3M4 14.5c.5-.8 2.8-.8 2.8.6 0 1.1-2.8 1.6-2.8 2.9h3" /></Svg>;
const LINK = <Svg><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
const UNDO = <Svg><path d="M9 14 4.5 9.5 9 5" /><path d="M4.5 9.5H15a5 5 0 0 1 0 10h-3" /></Svg>;
const REDO = <Svg><path d="M15 14l4.5-4.5L15 5" /><path d="M19.5 9.5H9a5 5 0 0 0 0 10h3" /></Svg>;

const ITEMS: Item[] = [
  { label: "Paragraph", visible: "Paragraph", wide: true, run: setBlockType(nodes.paragraph!), active: (s) => s.selection.$from.parent.type === nodes.paragraph },
  { label: "Bold", visible: <b className="font-bold">B</b>, group: true, run: toggleMark(marks.strong!), active: (s) => mark_active(s, marks.strong!) },
  { label: "Italic", visible: <i>I</i>, run: toggleMark(marks.em!), active: (s) => mark_active(s, marks.em!) },
  { label: "Underline", visible: <u>U</u>, unsupported: "Underline isn't part of the lesson format" },
  { label: "Bulleted list", visible: LIST, group: true, run: wrapInList(nodes.bullet_list!), active: (s) => in_node(s, "bullet_list") },
  { label: "Numbered list", visible: NUMBERED, run: wrapInList(nodes.ordered_list!), active: (s) => in_node(s, "ordered_list") },
  { label: "Link", visible: LINK, unsupported: "Links aren't part of the lesson format" },
  { label: "Teacher talk", visible: "Teacher talk", wide: true, group: true, run: toggleMark(marks.teacher_talk!), active: (s) => mark_active(s, marks.teacher_talk!) },
  { label: "Sample response", visible: "Sample response", wide: true, run: toggleMark(marks.sample_response!), active: (s) => mark_active(s, marks.sample_response!) },
];

function stack_sizes(view: EditorView): { undo: number; redo: number } {
  const um = (yUndoPluginKey.getState(view.state) as { undoManager?: { undoStack: unknown[]; redoStack: unknown[] } } | undefined)?.undoManager;
  return { undo: um?.undoStack.length ?? 0, redo: um?.redoStack.length ?? 0 };
}

function Sep() {
  return <span aria-hidden="true" className="bg-hair mx-0.5 h-4 w-px shrink-0" />;
}

/** One toolbar button. Off items stay focusable (aria-disabled) and say why in their tooltip. */
function Tool({ item, pressed, off, onRun }: { item: Pick<Item, "label" | "visible" | "wide" | "unsupported">; pressed?: boolean; off?: boolean; onRun?: () => void }) {
  return (
    <button
      type="button"
      aria-label={item.label}
      aria-pressed={pressed}
      aria-disabled={off || undefined}
      title={item.unsupported ?? item.label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => !off && onRun?.()}
      className={cn(
        "text-small inline-flex h-7 shrink-0 items-center justify-center rounded-sm",
        item.wide ? "px-1.5 font-medium" : "w-7",
        off ? "text-ink3 cursor-not-allowed opacity-60" : "text-ink2 hover:bg-well hover:text-ink",
        pressed && "bg-selected text-primary hover:bg-selected hover:text-primary",
        item.label === "Paragraph" && !pressed && "bg-well text-ink",
      )}
    >
      {item.visible}
    </button>
  );
}

/** `tick` changes on every transaction so the active states re-render. */
export function Toolbar({ view }: { view: EditorView | null; tick: number }) {
  if (!view) return null;
  const sizes = stack_sizes(view);
  const run = (cmd: Command) => {
    cmd(view.state, view.dispatch);
    view.focus();
  };
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      {ITEMS.map((it) => (
        <span key={it.label} className="contents">
          {it.group ? <Sep /> : null}
          {it.unsupported ? (
            <Tool item={it} off />
          ) : (
            <Tool item={it} pressed={it.active ? it.active(view.state) : undefined} onRun={() => run(it.run!)} />
          )}
        </span>
      ))}
      <Sep />
      <Tool item={{ label: "Undo", visible: UNDO }} off={sizes.undo === 0} onRun={() => run((s) => undo(s))} />
      <Tool item={{ label: "Redo", visible: REDO }} off={sizes.redo === 0} onRun={() => run((s) => redo(s))} />
    </div>
  );
}
