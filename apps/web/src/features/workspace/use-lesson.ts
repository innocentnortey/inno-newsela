"use client";
import { useCallback, useEffect, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { usePoll } from "@/lib/use-poll";

type Lesson = components["schemas"]["Lesson"];

export type LessonLoad =
  | { kind: "loading" }
  | { kind: "ready"; lesson: Lesson }
  | { kind: "schema_unknown"; schemaVersion: number | null }
  | { kind: "not_found" }
  | { kind: "error" };

export function useLesson(lessonId: string | null): { load: LessonLoad; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [fetched, setFetched] = useState<{ key: string; lessonId: string | null; load: LessonLoad } | null>(null);
  const key = `${lessonId}#${attempt}`;

  useEffect(() => {
    if (lessonId === null) return;
    let alive = true;
    api
      .GET("/lessons/{lessonId}", { params: { path: { lessonId } } })
      .then((r) => {
        if (alive) setFetched({ key, lessonId, load: { kind: "ready", lesson: r.data as Lesson } });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (isApiError(e) && e.code === "UNAUTHENTICATED") return;
        let load: LessonLoad = { kind: "error" };
        if (isApiError(e) && e.code === "SCHEMA_UNKNOWN") {
          const v = Number(e.details.schema_version);
          load = { kind: "schema_unknown", schemaVersion: Number.isFinite(v) ? v : null };
        } else if (isApiError(e) && e.code === "NOT_FOUND") {
          load = { kind: "not_found" };
        }
        setFetched({ key, lessonId, load });
      });
    return () => {
      alive = false;
    };
  }, [lessonId, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (lessonId === null) return { load: { kind: "not_found" }, retry };
  // A re-read (after Submit, a decision...) keeps showing the lesson already on screen instead of flashing the skeleton.
  const keep = fetched && fetched.lessonId === lessonId && fetched.load.kind === "ready";
  const load: LessonLoad = fetched && (fetched.key === key || keep) ? fetched.load : { kind: "loading" };
  return { load, retry };
}

export function useIssues(lessonId: string | null, enabled: boolean) {
  return usePoll(
    () => api.GET("/lessons/{lessonId}/issues", { params: { path: { lessonId: lessonId as string } } }).then((r) => r.data as components["schemas"]["IssueList"]),
    { intervalMs: 3000, enabled: enabled && lessonId !== null },
  );
}
