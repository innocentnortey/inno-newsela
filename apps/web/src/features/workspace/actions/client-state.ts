import type { EditorClientState } from "@/editor/lesson-editor";

/** NL-63 may report an object instead of the bare state string; both are accepted. */
export interface ClientStateReport {
  state: EditorClientState;
  state_vector: string;
  stored: boolean;
}
export type ClientStateInput = EditorClientState | ClientStateReport;

export function stateOf(c: ClientStateInput): EditorClientState {
  return typeof c === "string" ? c : c.state;
}

const SAVING: EditorClientState[] = ["connecting", "saving", "DISCONNECTED"];

export function isSaving(c: ClientStateInput): boolean {
  const state = stateOf(c);
  if (typeof c === "string") return SAVING.includes(state);
  return state !== "read_only" && (!c.stored || SAVING.includes(state));
}

/** The vector sent with Submit. The string form has no vector, so the stored one goes; the server's cover check is the guard. */
export function submitVector(c: ClientStateInput, lesson: { state_vector: string }): string {
  return typeof c === "string" ? lesson.state_vector : c.state_vector;
}
