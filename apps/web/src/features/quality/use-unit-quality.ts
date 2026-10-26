"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api-client";
import { fetchUnitMetrics, type UnitMetrics } from "./data";

export function useUnitQuality(unitKey: string) {
  const [data, setData] = useState<UnitMetrics | undefined>();
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const started = useRef(false);

  const load = useCallback(async () => {
    try {
      const m = await fetchUnitMetrics(unitKey);
      if (!alive.current) return;
      setData(m);
      setError(false);
    } catch (e) {
      if (!alive.current) return;
      if (isApiError(e) && e.code === "NOT_FOUND") setNotFound(true);
      else setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [unitKey]);

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      void load();
    }
    return () => {
      alive.current = false;
    };
  }, [load]);

  const retry = useCallback(() => {
    setError(false);
    setLoading(true);
    void load();
  }, [load]);

  return { data, error, loading, notFound, retry };
}
