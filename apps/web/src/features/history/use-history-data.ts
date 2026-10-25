"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isApiError, type createApiClient } from "@/lib/api-client";
import type { LessonHistory } from "./derive";

export type ApiClient = ReturnType<typeof createApiClient>;

export interface HistoryData {
  status: "loading" | "ready" | "error";
  history: LessonHistory | null;
  error: ApiError | null;
  reload: () => Promise<void>;
}

const NETWORK = new ApiError({
  status: 0,
  code: "NETWORK",
  message: "Couldn't reach Lesson Studio. Try again.",
});

export function useHistoryData(
  client: ApiClient,
  lessonId: string,
): HistoryData {
  const [state, setState] = useState<Omit<HistoryData, "reload">>({
    status: "loading",
    history: null,
    error: null,
  });
  const counter = useRef(0);

  const load = useCallback(async () => {
    const mine = ++counter.current;
    try {
      const { data } = await client.GET("/lessons/{lessonId}/history", {
        params: { path: { lessonId } },
      });
      if (counter.current === mine)
        setState({ status: "ready", history: data ?? null, error: null });
    } catch (e) {
      if (counter.current === mine)
        setState({
          status: "error",
          history: null,
          error: isApiError(e) ? e : NETWORK,
        });
    }
  }, [client, lessonId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the one fetch on mount; setState runs after the await
    void load();
    return () => {
      // A counter, not a DOM node: bumping it supersedes any load still in flight.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      counter.current++;
    };
  }, [load]);

  const reload = useCallback(async () => {
    setState({ status: "loading", history: null, error: null });
    await load();
  }, [load]);

  return { ...state, reload };
}
