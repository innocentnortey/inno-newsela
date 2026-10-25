"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

type Unit = components["schemas"]["Unit"];
type RunProgress = components["schemas"]["RunProgress"];

export type UnitsHomeState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; units: Unit[]; progress: Record<string, RunProgress | "unavailable"> };

export function useUnitsHome(): { state: UnitsHomeState; retry: () => void } {
  const [state, setState] = useState<UnitsHomeState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.GET("/units");
        const units = data?.units ?? [];
        const entries = await Promise.all(
          units
            .filter((u) => u.latest_run)
            .map(async (u): Promise<[string, RunProgress | "unavailable"]> => {
              const runId = u.latest_run!.run_id;
              try {
                const res = await api.GET("/runs/{runId}/progress", { params: { path: { runId } } });
                return [runId, res.data ?? "unavailable"];
              } catch {
                return [runId, "unavailable"];
              }
            }),
        );
        if (alive) setState({ kind: "ready", units, progress: Object.fromEntries(entries) });
      } catch {
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
