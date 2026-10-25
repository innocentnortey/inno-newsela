"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { ACCEPTED_TOAST, LOCKED_TEXT, MOVED_ON_TEXT, NETWORK_TEXT, NO_SELECTION_TEXT, REJECTED_TOAST, TOO_LONG_TEXT, errorText } from "./copy";

type Suggestion = components["schemas"]["Suggestion"];

/** Yjs relative positions, base64 (CON-17 Anchor). The editor (NL-63/NL-116) supplies them. */
export interface AssistSelection {
  text: string;
  anchor?: { start: string; end: string };
}

export type Phase = "loading" | "idle" | "asking" | "pending" | "deciding" | "locked";
export interface AssistError { code: string; text: string }

const OPEN_STATES = ["in_review", "changes_requested", "reopened"];
const MAX_TEXT = 2000;

export interface UseSuggestionsArgs {
  lessonId: string;
  selection: AssistSelection | null;
  onPendingChange?: (pending: boolean) => void;
  onLessonChanged?: () => void;
}

export function useSuggestions({ lessonId, selection, onPendingChange, onLessonChanged }: UseSuggestionsArgs) {
  const announce = useAnnounce();
  const [phase, setPhase] = useState<Phase>("loading");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<AssistError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pendingCb = useRef(onPendingChange);
  useEffect(() => {
    pendingCb.current = onPendingChange;
  });

  const readList = useCallback(async (): Promise<Suggestion | null> => {
    const r = await api.GET("/lessons/{lessonId}/suggestions", { params: { path: { lessonId } } });
    return r.data?.suggestions.find((s) => s.status === "pending") ?? null;
  }, [lessonId]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const l = await api.GET("/lessons/{lessonId}", { params: { path: { lessonId } } });
        if (l.data && !OPEN_STATES.includes(l.data.state)) {
          if (live) setPhase("locked");
          return;
        }
      } catch {
        // A failed lesson read is not a lock; the server still refuses on ask.
      }
      try {
        const s = await readList();
        if (!live) return;
        setSuggestion(s);
        setPhase(s ? "pending" : "idle");
      } catch (e) {
        if (!live) return;
        setPhase(isApiError(e) && (e.code === "LESSON_LOCKED" || e.code === "ROLE_FORBIDDEN") ? "locked" : "idle");
      }
    })();
    return () => {
      live = false;
    };
  }, [lessonId, readList]);

  const isPending = suggestion !== null;
  useEffect(() => {
    pendingCb.current?.(isPending);
  }, [isPending]);

  const fail = useCallback((e: unknown, afterPhase: Phase) => {
    if (isApiError(e)) {
      if (e.code === "LESSON_LOCKED") {
        setSuggestion(null);
        setPhase("locked");
        return;
      }
      setError({ code: e.code, text: errorText(e.code, e.message) ?? e.message });
    } else {
      setError({ code: "NETWORK", text: NETWORK_TEXT });
    }
    setPhase(afterPhase);
  }, []);

  const ask = useCallback(
    async (note: string) => {
      if (inFlight.current) return;
      if (!selection?.anchor || !selection.text) {
        setError({ code: "NO_SELECTION", text: NO_SELECTION_TEXT });
        return;
      }
      if (selection.text.length > MAX_TEXT) {
        setError({ code: "TOO_LONG", text: TOO_LONG_TEXT });
        return;
      }
      inFlight.current = true;
      setError(null);
      setPhase("asking");
      try {
        const r = await api.POST("/lessons/{lessonId}/suggestions", {
          params: { path: { lessonId } },
          body: { anchor: selection.anchor, selected_text: selection.text, note },
        });
        setSuggestion(r.data as Suggestion);
        setPhase("pending");
      } catch (e) {
        fail(e, "idle");
      } finally {
        inFlight.current = false;
      }
    },
    [selection, lessonId, fail],
  );

  const decide = useCallback(
    async (decision: "accept" | "reject") => {
      if (inFlight.current || !suggestion) return;
      inFlight.current = true;
      setError(null);
      setPhase("deciding");
      try {
        await api.POST("/lessons/{lessonId}/suggestions/{suggestionId}/decision", {
          params: { path: { lessonId, suggestionId: suggestion.suggestion_id } },
          body: decision === "accept" ? { decision: "accept", anchored_text_now: selection?.text ?? null } : { decision: "reject" },
        });
        const msg = decision === "accept" ? ACCEPTED_TOAST : REJECTED_TOAST;
        setToast(msg);
        announce(msg);
        setSuggestion(null);
        setPhase("idle");
        if (decision === "accept") onLessonChanged?.();
      } catch (e) {
        const code = isApiError(e) ? e.code : null;
        if (code === "ANCHOR_CHANGED") {
          setSuggestion(null);
          fail(e, "idle");
        } else if (code === "INVALID_TRANSITION") {
          setError({ code, text: MOVED_ON_TEXT });
          try {
            const s = await readList();
            setSuggestion(s);
            setPhase(s ? "pending" : "idle");
          } catch {
            setPhase("pending");
          }
        } else if (code === "LESSON_LOCKED") {
          fail(e, "locked");
          setError({ code, text: LOCKED_TEXT });
        } else {
          fail(e, "pending");
        }
      } finally {
        inFlight.current = false;
      }
    },
    [suggestion, selection, lessonId, announce, onLessonChanged, readList, fail],
  );

  return { phase, suggestion, error, toast, clearToast: () => setToast(null), ask, decide };
}
