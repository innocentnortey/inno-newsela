"use client";
// Shell. Body owned by NL-64 after this ticket.
import type { components } from "@/lib/api-types";
import type { EditorClientState } from "@/editor/lesson-editor";

export interface WorkspaceActionBarProps {
  lesson: components["schemas"]["Lesson"];
  issues: components["schemas"]["IssueList"];
  clientState: EditorClientState;
}

export function WorkspaceActionBar(props: WorkspaceActionBarProps) {
  return (
    <div data-testid="action-bar-placeholder" data-client-state={props.clientState}>
      Built by NL-64.
    </div>
  );
}
