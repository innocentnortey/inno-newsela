"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isApiError, type createApiClient } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import type { Lesson } from "./derive";

export type ApiClient = ReturnType<typeof createApiClient>;
type IssueList = components["schemas"]["IssueList"];
type LessonHistory = components["schemas"]["LessonHistory"];

export interface ApprovalData {
  status: "loading" | "ready" | "error";
  lesson: Lesson | null;
  issues: IssueList | null;
  issuesSettled: boolean;
  history: LessonHistory | null;
  error: ApiError | null;
  reload: () => Promise<void>;
}

const NETWORK = new ApiError({ status: 0, code: "NETWORK", message: "Couldn't reach Lesson Studio. Try again." });

export function useApprovalData(client: ApiClient, lessonId: string): ApprovalData {
  const [state, setState] = useState<Omit<ApprovalData, "reload">>({
    status: "loading", lesson: null, issues: null, issuesSettled: false, history: null, error: null,
  });
  const counter = useRef(0);

  const load = useCallback(async () => {
    const mine = ++counter.current;
    const live = () => counter.current === mine;
    setState((s) => ({ ...s, issuesSettled: false, error: null }));
    const path = { params: { path: { lessonId } } };
    const lessonP = (async () => {
      try {
        const { data } = await client.GET("/lessons/{lessonId}", path);
        if (!live() || !data) return;
        setState((s) => ({ ...s, status: "ready", lesson: data }));
        if (data.state === "approved" || data.state === "exported") {
          try {
            const h = await client.GET("/lessons/{lessonId}/history", path);
            if (live() && h.data) setState((s) => ({ ...s, history: h.data ?? null }));
          } catch { /* the approved line then omits the date */ }
        }
      } catch (e) {
        if (live()) setState((s) => ({ ...s, status: "error", error: isApiError(e) ? e : NETWORK }));
      }
    })();
    const issuesP = (async () => {
      let data: IssueList | null = null;
      try {
        data = (await client.GET("/lessons/{lessonId}/issues", path)).data ?? null;
      } catch { /* not fatal: the checklist shows the server's items only */ }
      if (live()) setState((s) => ({ ...s, issues: data, issuesSettled: true }));
    })();
    await Promise.all([lessonP, issuesP]);
  }, [client, lessonId]);

  useEffect(() => {
    void load();
    return () => {
      // A counter, not a DOM node: bumping it supersedes any load still in flight.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      counter.current++;
    };
  }, [load]);

  return { ...state, reload: load };
}
