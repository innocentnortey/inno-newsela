"use client";
// Shell. Body owned by NL-63 after this ticket.
import type { components } from "@/lib/api-types";

export type EditorClientState = "connecting" | "synced" | "saving" | "stored" | "DISCONNECTED" | "read_only";

export interface LessonEditorProps {
  lessonId: string;
  lesson: components["schemas"]["Lesson"];
  readOnly: boolean;
  onClientState: (s: EditorClientState) => void;
}

export function LessonEditor(props: LessonEditorProps) {
  return (
    <div data-testid="lesson-editor-placeholder" data-lesson-id={props.lessonId}>Built by NL-63.</div>
  );
}
