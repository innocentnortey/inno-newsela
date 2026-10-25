"use client";

import { useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { usePoll, type UsePollResult } from "@/lib/use-poll";
import { isGoing } from "./format";

type RunSummary = components["schemas"]["RunSummary"];

export function useRunSummary(
  runId: string,
): UsePollResult<RunSummary> & { notFound: boolean } {
  // Flags belong to one run id; a different id starts clean without a reset effect.
  const [flags, setFlags] = useState({
    runId,
    notFound: false,
  });
  const notFound = flags.runId === runId && flags.notFound;
  const doneRef = useRef(false);

  const fetcher = async (): Promise<RunSummary> => {
    try {
      const { data } = await api.GET("/runs/{runId}/summary", {
        params: { path: { runId } },
      });
      if (!data) throw new Error("empty");
      doneRef.current = !isGoing(data.state);
      return data;
    } catch (e) {
      if (isApiError(e) && e.code === "NOT_FOUND")
        setFlags((f) => ({ ...f, runId, notFound: true }));
      throw e;
    }
  };

  // Polling stops on the render that follows the data landing; flipping it inside the fetcher would drop an in-flight result.
  // eslint-disable-next-line react-hooks/refs -- read on the re-render caused by setData, by design
  const poll = usePoll(fetcher, { enabled: !doneRef.current && !notFound });
  return { ...poll, notFound };
}
