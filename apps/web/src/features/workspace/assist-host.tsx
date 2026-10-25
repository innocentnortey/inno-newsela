"use client";
// NL-116: the AI assist panel (SCR-13, NL-72) in the workspace rail slot. A thin wrapper so workspace-screen stays small.
import { AssistPanel, type AssistSelection } from "@/features/assist/assist-panel";

export interface AssistHostProps {
  lessonId: string;
  selection: AssistSelection | null;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
  onLessonChanged: () => void;
}

export function AssistHost(props: AssistHostProps) {
  return (
    <div data-testid="assist-host">
      <AssistPanel {...props} />
    </div>
  );
}
