"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { unitIdFromKey } from "@/lib/keys";

export type CoverageData = components["schemas"]["CoverageMatrix"];

/** One read on mount and on retry; nothing polls. */
export function useCoverage(unitKey: string) {
  const unitId = unitIdFromKey(unitKey) ?? unitKey;
  const [data, setData] = useState<CoverageData | undefined>();
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data: matrix } = await api.GET("/units/{unitId}/coverage", {
        params: { path: { unitId } },
      });
      if (!alive.current) return;
      if (!matrix) throw new Error("empty");
      setData(matrix);
      setError(false);
    } catch (e) {
      if (!alive.current) return;
      if (isApiError(e) && e.code === "NOT_FOUND") setNotFound(true);
      else setError(true);
    }
  }, [unitId]);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch once on mount; state is set after the await
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const retry = useCallback(() => {
    setError(false);
    void load();
  }, [load]);

  return { data, error, notFound, retry };
}
