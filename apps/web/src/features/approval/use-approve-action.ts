"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ApiClient } from "./use-approval-data";
import { RATINGS, shortHash, viewFromError, waitingOnThis, type ApproveView, type Lesson, type Rating } from "./derive";

export interface ApproveAction {
  rating: Rating | null;
  setRating: (r: Rating) => void;
  view: ApproveView | null;
  submitting: boolean;
  result: { name: string; short: string; ratingLabel: string; on: string; thanks: string[] } | null;
  approve: () => Promise<void>;
  clearView: () => void;
  firstRadioRef: RefObject<HTMLInputElement | null>;
}

export function useApproveAction(a: { client: ApiClient; lesson: Lesson; userName: string; onApproved: () => void }): ApproveAction {
  const { client, lesson, userName, onApproved } = a;
  const [rating, setRating] = useState<Rating | null>(null);
  const [view, setView] = useState<ApproveView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApproveAction["result"]>(null);
  const inFlight = useRef(false);
  const firstRadioRef = useRef<HTMLInputElement | null>(null);
  const wantFocus = useRef(false);
  const pinHash = lesson.snapshot?.content_hash ?? null;

  // After Reload (a new pin) everything resets except the chosen rating.
  const lastPin = useRef(pinHash);
  useEffect(() => {
    if (lastPin.current === pinHash) return;
    lastPin.current = pinHash;
    setView(null);
    setSubmitting(false);
    setResult(null);
    inFlight.current = false;
  }, [pinHash]);

  // The radios are disabled while the request runs; focus the first one once they are enabled again.
  useEffect(() => {
    if (wantFocus.current && !submitting) {
      wantFocus.current = false;
      firstRadioRef.current?.focus();
    }
  });

  const approve = useCallback(async () => {
    if (inFlight.current || result) return;
    const snapshot = lesson.snapshot;
    if (snapshot === null) return;
    if (rating === null) {
      setView({ kind: "rating" });
      firstRadioRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setView(null);
    try {
      await client.POST("/lessons/{lessonId}/transitions", {
        params: { path: { lessonId: lesson.lesson_id } },
        body: { action: "approve", snapshot_hash: snapshot.content_hash, snapshot_state_vector: snapshot.state_vector, rating },
      });
      setResult({
        name: userName,
        short: shortHash(snapshot.content_hash),
        ratingLabel: RATINGS.find((r) => r.value === rating)?.label ?? rating,
        on: new Date().toISOString().slice(0, 10),
        thanks: waitingOnThis(lesson).map((d) => d.lessonId),
      });
      onApproved();
    } catch (e) {
      const v = viewFromError(e);
      setView(v);
      wantFocus.current = v.kind === "rating";
      inFlight.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [client, lesson, rating, result, userName, onApproved]);

  return { rating, setRating, view, submitting, result, approve, clearView: () => setView(null), firstRadioRef };
}
