import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api-types";

type Suggestion = components["schemas"]["Suggestion"];

export interface SuggestionCardProps {
  suggestion: Pick<Suggestion, "selected_text" | "suggested_text">;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}

/** d1-05 anatomy. Both texts are plain React children: never HTML, never markdown (R-58). */
export function SuggestionCard({ suggestion, busy, onAccept, onReject }: SuggestionCardProps) {
  return (
    <div className="border-hair bg-panel flex flex-col gap-3 rounded-lg border p-3" data-testid="suggestion-card">
      <div className="flex flex-col gap-1">
        <p className="text-caps text-ink2 uppercase">Your text</p>
        <blockquote className="text-small text-ink2 border-hair border-l-2 pl-3">{suggestion.selected_text}</blockquote>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-caps text-ink2 uppercase">Suggested rewrite</p>
        <p className="text-body text-ink" data-testid="suggested-text">{suggestion.suggested_text}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" disabled={busy} onClick={onAccept}>Accept</Button>
        <Button variant="secondary" disabled={busy} onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}
