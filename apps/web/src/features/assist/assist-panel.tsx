"use client";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/text-input";
import { Toast, ToastRegion } from "@/components/ui/toast";
import { ASK, LOCKED_TEXT, NO_SELECTION_TEXT, TITLE, WARN } from "./copy";
import { SuggestionCard } from "./suggestion-card";
import { useSuggestions, type AssistSelection } from "./use-suggestions";

export type { AssistSelection } from "./use-suggestions";

export interface AssistPanelProps {
  lessonId: string;
  selection: AssistSelection | null;
  onClose: () => void;
  onPendingChange?: (pending: boolean) => void;
  onLessonChanged?: () => void;
}

export function AssistPanel({ lessonId, selection, onClose, onPendingChange, onLessonChanged }: AssistPanelProps) {
  const { phase, suggestion, error, toast, clearToast, ask, decide } = useSuggestions({ lessonId, selection, onPendingChange, onLessonChanged });
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  const idle = phase === "idle";
  useEffect(() => {
    if (idle) noteRef.current?.focus();
  }, [idle]);
  useEffect(() => {
    if (error) errRef.current?.focus();
  }, [error]);

  const showCard = suggestion !== null && (phase === "pending" || phase === "deciding");
  return (
    <section aria-label="AI assist" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" aria-label="Back to the rail" onClick={onClose}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="size-3">
            <path d="M8 2 4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Button>
        <h2 className="text-body text-ink font-semibold">{TITLE}</h2>
      </div>
      {error ? (
        <div ref={errRef} tabIndex={-1} className="rounded-lg outline-offset-2" data-testid="assist-error">
          <Banner level="blocking" title={error.text} />
        </div>
      ) : null}
      {phase === "locked" ? (
        <p className="text-body text-ink2">{LOCKED_TEXT}</p>
      ) : (
        <>
          {selection ? (
            <blockquote className="text-small text-ink2 border-hair border-l-2 pl-3" data-testid="assist-quote">{selection.text}</blockquote>
          ) : (
            <Banner level="info" title={NO_SELECTION_TEXT} />
          )}
          {showCard ? (
            <SuggestionCard suggestion={suggestion} busy={phase === "deciding"} onAccept={() => decide("accept")} onReject={() => decide("reject")} />
          ) : (
            <>
              <Textarea ref={noteRef} label="My note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              <Banner level="advisory" title={WARN} />
              <div>
                <Button variant="secondary" loading={phase === "asking"} disabled={!selection?.anchor || phase === "loading"} onClick={() => ask(note)}>
                  {ASK}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      <ToastRegion>{toast ? <Toast message={toast} onDismiss={clearToast} /> : null}</ToastRegion>
    </section>
  );
}
