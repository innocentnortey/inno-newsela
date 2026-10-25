"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { useAnnounce } from "@/lib/announce";
import {
  applyChoiceResult,
  headingCopy,
  refusalCopy,
  type ChoiceRequest,
  type Report,
  type ReportActions,
  type TargetStatus,
} from "./report-model";

type Unit = components["schemas"]["Unit"];
type OutlineVersion = components["schemas"]["OutlineVersion"];

export type Phase = "loading" | "slow" | "ready" | "notfound" | "error";

export interface NewerVersion {
  version_number: number;
  created_at: string;
  same_as_version: number | null;
  changed_lessons: number;
}

function omit<T>(o: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

const CONNECTION_COPY = "Couldn't start. Check your connection and try again.";

export function useValidationReport(unitKey: string, version: number) {
  const announce = useAnnounce();
  const [phase, setPhase] = useState<Phase>("loading");
  const [report, setReport] = useState<Report | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [versionInfo, setVersionInfo] = useState<OutlineVersion | null>(null);
  const [newer, setNewer] = useState<NewerVersion | null>(null);
  const [status, setStatus] = useState<Record<string, TargetStatus>>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [focusFirst, setFocusFirst] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const reportRef = useRef<Report | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    reportRef.current = report;
    statusRef.current = status;
  });

  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => !cancelled && setPhase((p) => (p === "loading" ? "slow" : p)), 1000);
    (async () => {
      try {
        const { data: list } = await api.GET("/units");
        const u = list!.units.find((x) => x.unit_key === unitKey);
        const v = u?.versions.find((x) => x.version_number === version);
        if (!u || !v) {
          if (!cancelled) setPhase("notfound");
          return;
        }
        setTotalRows(v.row_counts.total_rows);
        const { data } = await api.GET("/outline-versions/{outlineVersionId}/report", {
          params: { path: { outlineVersionId: v.outline_version_id } },
        });
        if (cancelled) return;
        const top = u.versions.reduce((a, b) => (b.version_number > a.version_number ? b : a));
        setUnit(u);
        setVersionInfo(v);
        setNewer(
          top.version_number > version
            ? { version_number: top.version_number, created_at: top.created_at, same_as_version: top.same_as_version, changed_lessons: top.changed_lessons }
            : null,
        );
        setReport(data!);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setPhase(isApiError(e) && e.code === "NOT_FOUND" ? "notfound" : "error");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [unitKey, version, attempt]);

  useEffect(() => {
    if (focusFirst === 0) return;
    document.querySelector<HTMLElement>("[data-first-unconfirmed]")?.focus();
  }, [focusFirst]);

  const choose = useCallback(
    async (req: ChoiceRequest): Promise<boolean> => {
      const current = reportRef.current;
      if (!current) return false;
      setStatus((s) => ({ ...s, [req.target_id]: { request: req, phase: "saving", message: null } }));
      try {
        const { data } = await api.POST("/outline-versions/{outlineVersionId}/choices", {
          params: { path: { outlineVersionId: current.outline_version_id } },
          body: req,
        });
        const next = applyChoiceResult(reportRef.current ?? current, data!);
        setReport(next);
        setStatus((s) => {
          return omit(s, req.target_id);
        });
        announce(headingCopy(next.counts));
        return true;
      } catch (e) {
        if (isApiError(e) && e.code === "ROLE_FORBIDDEN") {
          setStatus((s) => {
            return omit(s, req.target_id);
          });
          setForbidden(e.message);
        } else {
          const message = isApiError(e) && (e.code === "INVALID_CHOICE" || e.code === "INVALID_TRANSITION") ? e.message : null;
          setStatus((s) => ({ ...s, [req.target_id]: { request: req, phase: "failed", message } }));
        }
        return false;
      }
    },
    [announce],
  );

  const retry = useCallback(
    async (targetId: string) => {
      const s = statusRef.current[targetId];
      return s ? choose(s.request) : false;
    },
    [choose],
  );
  const undo = useCallback((targetId: string) => choose({ target_id: targetId, kind: "revert" }), [choose]);

  const generate = useCallback(async () => {
    const current = reportRef.current;
    if (!current) return;
    setGenerating(true);
    try {
      const { data } = await api.GET("/outline-versions/{outlineVersionId}/report", {
        params: { path: { outlineVersionId: current.outline_version_id } },
      });
      const fresh = data!;
      setReport(fresh);
      if (!fresh.generate_allowed || fresh.counts.errors_unconfirmed > 0) {
        const msg = refusalCopy(fresh.counts.errors_unconfirmed);
        setRefusal(msg);
        announce(msg);
        setFocusFirst((n) => n + 1);
      } else {
        setRefusal(null);
        setDialogOpen(true);
      }
    } catch (e) {
      if (isApiError(e) && e.code === "VALIDATION_INCOMPLETE") {
        try {
          const { data } = await api.GET("/outline-versions/{outlineVersionId}/report", {
            params: { path: { outlineVersionId: current.outline_version_id } },
          });
          setReport(data!);
          const msg = refusalCopy(data!.counts.errors_unconfirmed);
          setRefusal(msg);
          announce(msg);
          setFocusFirst((n) => n + 1);
        } catch {
          setRefusal(CONNECTION_COPY);
        }
      } else {
        setRefusal(CONNECTION_COPY);
      }
    } finally {
      setGenerating(false);
    }
  }, [announce]);

  const actions: ReportActions = { choose, retry, undo, generate };
  return {
    phase,
    report,
    unit,
    versionInfo,
    totalRows,
    newer,
    status,
    refusal,
    forbidden,
    generating,
    dialogOpen,
    closeDialog: () => setDialogOpen(false),
    actions,
    reload: () => {
      setPhase("loading");
      setAttempt((n) => n + 1);
    },
  };
}
