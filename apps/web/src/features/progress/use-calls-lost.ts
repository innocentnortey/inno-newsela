"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

/** Calls lost in flight, read once per run-state change from the summary; never polled, errors keep the line hidden. */
export function useCallsLost(
  runId: string,
  state: components["schemas"]["RunState"] | undefined,
): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!state) return;
    let alive = true;
    api
      .GET("/runs/{runId}/summary", { params: { path: { runId } } })
      .then(({ data }) => {
        if (alive && data) setN(data.calls_lost_in_flight);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [runId, state]);
  return n;
}
