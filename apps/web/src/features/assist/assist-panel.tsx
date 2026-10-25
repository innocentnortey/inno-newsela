"use client";
// Shell. Body owned by NL-72 after this ticket.
import { Button } from "@/components/ui/button";

export interface AssistPanelProps {
  lessonId: string;
  selection: { text: string } | null;
  onClose: () => void;
}

export function AssistPanel(props: AssistPanelProps) {
  return (
    <section aria-label="AI assist" className="flex flex-col gap-2">
      <p>Built by NL-72.</p>
      <Button variant="secondary" onClick={props.onClose}>
        Close
      </Button>
    </section>
  );
}
