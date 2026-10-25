"use client";

import { useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { usePoll, type UsePollResult } from "@/lib/use-poll";

type UnitPlan = components["schemas"]["UnitPlan"];

export function useUnitPlan(
  runId: string,
): UsePollResult<UnitPlan> & { notFound: boolean } {
  // Flags belong to one run id; a different id starts clean without a reset effect.
  const [flags, setFlags] = useState({
    runId,
    notFound: false,
    settled: false,
  });
  const notFound = flags.runId === runId && flags.notFound;
  const settled = flags.runId === runId && flags.settled;

  const fetcher = async (): Promise<UnitPlan> => {
    try {
      const { data } = await api.GET("/runs/{runId}/plan", {
        params: { path: { runId } },
      });
      if (!data) throw new Error("empty");
      setFlags({ runId, notFound: false, settled: data.state !== "planning" });
      return data;
    } catch (e) {
      if (isApiError(e) && e.code === "NOT_FOUND")
        setFlags({ runId, notFound: true, settled: false });
      throw e;
    }
  };

  const poll = usePoll(fetcher, { enabled: !settled && !notFound });
  return { ...poll, notFound };
}
