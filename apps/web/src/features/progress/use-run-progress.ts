"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { usePoll, type UsePollResult } from "@/lib/use-poll";
import { BackoffSkip, backoffMs } from "./backoff";

type RunProgress = components["schemas"]["RunProgress"];
// partial and paused keep polling: a control can restart them.
const TERMINAL: readonly string[] = ["complete", "cancelled", "capped"];

export function useRunProgress(
  runId: string,
): UsePollResult<RunProgress> & { notFound: boolean } {
  const failures = useRef(0);
  const nextAttemptAt = useRef(0);
  // Flags belong to one run id; a different id starts clean without a reset effect.
  const [flags, setFlags] = useState({
    runId,
    notFound: false,
    terminal: false,
  });
  const notFound = flags.runId === runId && flags.notFound;
  const terminal = flags.runId === runId && flags.terminal;
  const setNotFound = (v: boolean) =>
    setFlags((f) => ({ ...f, runId, notFound: v }));
  const setTerminal = (v: boolean) =>
    setFlags((f) => ({ ...f, runId, terminal: v }));

  useEffect(() => {
    failures.current = 0;
    nextAttemptAt.current = 0;
  }, [runId]);

  const fetcher = async (): Promise<RunProgress> => {
    if (Date.now() < nextAttemptAt.current) throw new BackoffSkip();
    try {
      const { data } = await api.GET("/runs/{runId}/progress", {
        params: { path: { runId } },
      });
      if (!data) throw new Error("empty");
      failures.current = 0;
      nextAttemptAt.current = 0;
      setTerminal(TERMINAL.includes(data.state));
      return data;
    } catch (e) {
      failures.current += 1;
      nextAttemptAt.current = Date.now() + backoffMs(failures.current);
      if (isApiError(e) && e.code === "NOT_FOUND") setNotFound(true);
      throw e;
    }
  };

  const poll = usePoll(fetcher, { enabled: !terminal && !notFound });
  const { retry: pollRetry } = poll;
  // A person asking for a fresh read (retry button, after a control) is not held back by the backoff window.
  const retry = useCallback(() => {
    nextAttemptAt.current = 0;
    setTerminal(false);
    pollRetry();
  }, [pollRetry]);
  return { ...poll, retry, notFound };
}
