"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard } from "@/features/board/data";
import { api, isApiError } from "@/lib/api-client";
import { capMessage, COPY } from "./copy";

export const TRIAL_UNIT_KEY = "g6-u4";
/** [A] assumption: a candidate costs about $0.49 in the contract example; SCR-5 suggests caps from PD-14 after SP-1. */
export const TRIAL_CAP_USD = 1.0;
const POLL_MS = 2000;
const POLL_MAX_MS = 90_000;

export interface LessonOption {
  lessonId: string;
  lessonKey: string;
  number: number;
  label: string;
}
export type TrialResult =
  | { kind: "making"; number: number }
  | { kind: "made"; number: number; lessonKey: string; candidateId: string }
  | { kind: "slow"; number: number; lessonKey: string }
  | null;

const bareTitle = (t: string) => t.replace(/^Lesson \d+:\s*/, "");

export function useTrial(opts: {
  promptVersionId: string;
  onForbidden: () => void;
}) {
  const { promptVersionId, onForbidden } = opts;
  const [lessons, setLessons] = useState<LessonOption[] | undefined>();
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lessonId, setLessonId] = useState("");
  const [result, setResult] = useState<TrialResult>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const [units, board] = await Promise.all([
        api.GET("/units", {}),
        fetchBoard(TRIAL_UNIT_KEY, null),
      ]);
      if (!alive.current) return;
      if (!units.data) throw new Error("empty");
      const unit = units.data.units.find((u) => u.unit_key === TRIAL_UNIT_KEY);
      const newest = [...(unit?.versions ?? [])].sort(
        (a, b) => b.version_number - a.version_number,
      )[0];
      setOutlineId(newest?.outline_version_id ?? null);
      setLessons(
        board.board.rows.flatMap((r) =>
          r.number === null
            ? []
            : [
                {
                  lessonId: r.lesson_id,
                  lessonKey: r.lesson_key,
                  number: r.number,
                  label: `Lesson ${r.number}: ${bareTitle(r.title)}`,
                },
              ],
        ),
      );
      setLoadError(false);
    } catch {
      if (alive.current) setLoadError(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch once on mount; state is set after the await
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const retry = useCallback(() => {
    setLoadError(false);
    void load();
  }, [load]);

  const start = useCallback(async () => {
    const lesson = lessons?.find((l) => l.lessonId === lessonId);
    if (inflight.current || !lesson || !outlineId) return;
    inflight.current = true;
    setBusy(true);
    setProblem(null);
    setResult({ kind: "making", number: lesson.number });
    try {
      const { data: run } = await api.POST("/runs", {
        params: { header: { "Idempotency-Key": crypto.randomUUID() } },
        body: {
          outline_version_id: outlineId,
          mode: "trial",
          scope: { kind: "rows", rows: [lesson.number] },
          lesson_id: lesson.lessonId,
          prompt_version_id: promptVersionId,
          cap_usd: TRIAL_CAP_USD,
        },
      });
      if (!run) throw new Error("empty");
      const until = Date.now() + POLL_MAX_MS;
      while (alive.current && Date.now() < until) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!alive.current) return;
        const { data: history } = await api.GET("/lessons/{lessonId}/history", {
          params: { path: { lessonId: lesson.lessonId } },
        });
        const found = history?.versions.find(
          (v) => v.kind === "candidate" && v.provenance.run_id === run.run_id,
        );
        if (found) {
          setResult({
            kind: "made",
            number: lesson.number,
            lessonKey: lesson.lessonKey,
            // CON-16: a candidate is addressed by its run id (the route answers NOT_FOUND for a lesson version id).
            candidateId: run.run_id,
          });
          return;
        }
      }
      if (alive.current)
        setResult({
          kind: "slow",
          number: lesson.number,
          lessonKey: lesson.lessonKey,
        });
    } catch (e) {
      if (!alive.current) return;
      setResult(null);
      if (isApiError(e) && e.code === "ROLE_FORBIDDEN") onForbidden();
      else if (isApiError(e) && e.code === "DAY_CAP_REACHED") {
        const r = e.details.remaining_usd;
        setProblem(capMessage(typeof r === "number" ? r : null));
      } else setProblem(COPY.trialFailed);
    } finally {
      inflight.current = false;
      if (alive.current) setBusy(false);
    }
  }, [lessons, lessonId, outlineId, promptVersionId, onForbidden]);

  return {
    lessons,
    outlineId,
    loadError,
    lessonId,
    setLessonId,
    result,
    problem,
    busy,
    retry,
    start,
  };
}
