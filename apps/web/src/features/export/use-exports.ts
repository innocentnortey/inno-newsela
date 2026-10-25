"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { unitIdFromKey } from "@/lib/keys";

export type ExportList = components["schemas"]["ExportList"];
export type ExportResult =
  | { kind: "written"; version: number; count: number }
  | { kind: "same"; version: number };
export type CreateProblem = "failed" | "forbidden" | null;

export function useExports(unitKey: string) {
  const unitId = unitIdFromKey(unitKey) ?? unitKey;
  const [data, setData] = useState<ExportList | undefined>();
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [problem, setProblem] = useState<CreateProblem>(null);
  const [downloadFailedFor, setDownloadFailedFor] = useState<number | null>(
    null,
  );
  const inflight = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data: list } = await api.GET("/units/{unitId}/exports", {
        params: { path: { unitId } },
      });
      if (!alive.current) return;
      if (!list) throw new Error("empty");
      setData(list);
      setError(false);
    } catch (e) {
      if (!alive.current) return;
      if (isApiError(e) && e.code === "NOT_FOUND") setNotFound(true);
      else if (isApiError(e) && e.code === "ROLE_FORBIDDEN") setForbidden(true);
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

  const create = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setPending(true);
    setProblem(null);
    setResult(null);
    try {
      const { data: made } = await api.POST("/units/{unitId}/exports", {
        params: { path: { unitId } },
      });
      if (!made) throw new Error("empty");
      setResult(
        made.same_as_previous
          ? { kind: "same", version: made.version_number }
          : {
              kind: "written",
              version: made.version_number,
              count: made.included.length,
            },
      );
      await load();
    } catch (e) {
      setProblem(
        isApiError(e) && e.code === "ROLE_FORBIDDEN" ? "forbidden" : "failed",
      );
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }, [unitId, load]);

  /** Saves the server's file as it came; nothing is rebuilt here. */
  const download = useCallback(async (exportId: string, version: number) => {
    setDownloadFailedFor(null);
    try {
      const { data: file } = await api.GET("/exports/{exportId}/download", {
        params: { path: { exportId } },
      });
      if (!file) throw new Error("empty");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `lesson-export-v${version}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadFailedFor(version);
    }
  }, []);

  return {
    data,
    error,
    notFound,
    forbidden,
    pending,
    result,
    problem,
    downloadFailedFor,
    retry,
    create,
    download,
  };
}
