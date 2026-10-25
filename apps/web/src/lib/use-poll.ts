"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePollOptions {
  intervalMs?: number;
  staleAfterMs?: number;
  enabled?: boolean;
}
export interface UsePollResult<T> {
  data: T | undefined;
  dataAt: Date | undefined;
  stale: boolean;
  error: unknown;
  retry: () => void;
}

export function usePoll<T>(fetcher: () => Promise<T>, opts: UsePollOptions = {}): UsePollResult<T> {
  const { intervalMs = 2000, staleAfterMs = 10000, enabled = true } = opts;
  const [data, setData] = useState<T | undefined>(undefined);
  const [dataAt, setDataAt] = useState<Date | undefined>(undefined);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const runNow = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let lastSuccess = Date.now();

    const tick = async () => {
      if (running) return;
      running = true;
      if (timer) clearTimeout(timer);
      try {
        const value = await fetcherRef.current();
        if (!alive) return;
        lastSuccess = Date.now();
        setData(value);
        setDataAt(new Date());
        setError(undefined);
        setStale(false);
      } catch (e) {
        if (!alive) return;
        setError(e);
        if (Date.now() - lastSuccess > staleAfterMs) setStale(true);
      } finally {
        running = false;
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    };
    runNow.current = () => void tick();
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, staleAfterMs, enabled]);

  const retry = useCallback(() => runNow.current(), []);
  return { data, dataAt, stale, error, retry };
}
