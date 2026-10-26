"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { savedMessage } from "./copy";

export type PromptVersions = components["schemas"]["PromptVersions"];
export type GuidanceVersion = components["schemas"]["GuidanceVersion"];
export type SaveProblem =
  { kind: "reason" } | { kind: "stale" } | { kind: "failed" } | null;

export function useGuidance() {
  const router = useRouter();
  const wanted = useSearchParams().get("version");
  const [data, setData] = useState<PromptVersions | undefined>();
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const inflight = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async (): Promise<PromptVersions | undefined> => {
    try {
      const { data: list } = await api.GET("/prompt-versions", {});
      if (!alive.current) return undefined;
      if (!list) throw new Error("empty");
      setData(list);
      setError(false);
      return list;
    } catch (e) {
      if (!alive.current) return undefined;
      if (isApiError(e) && e.code === "ROLE_FORBIDDEN") setForbidden(true);
      setError(true);
      return undefined;
    }
  }, []);

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

  const versions = [...(data?.guidance_versions ?? [])].sort(
    (a, b) => b.number - a.number,
  );
  const latest = versions[0];
  const selected = versions.find((v) => v.version_id === wanted) ?? latest;

  const goTo = useCallback(
    (id: string) =>
      router.replace(`/prompt-guidance?version=${encodeURIComponent(id)}`),
    [router],
  );

  const save = useCallback(
    async (guidanceText: string, reason: string): Promise<boolean> => {
      if (inflight.current || !latest) return false;
      inflight.current = true;
      setSaving(true);
      setProblem(null);
      setMessage(null);
      const base = latest;
      try {
        const { data: made } = await api.POST("/prompt-versions", {
          body: {
            base_version_id: base.version_id,
            guidance_text: guidanceText,
            reason,
          },
        });
        if (!made) throw new Error("empty");
        await load();
        goTo(made.version_id);
        setMessage(savedMessage(made.number, base.number));
        return true;
      } catch (e) {
        if (isApiError(e) && e.code === "REASON_REQUIRED")
          setProblem({ kind: "reason" });
        else if (isApiError(e) && e.code === "STALE_BASE") {
          const list = await load();
          const id = e.details.latest_version_id;
          const newest = [...(list?.guidance_versions ?? [])].sort(
            (a, b) => b.number - a.number,
          )[0];
          goTo(
            typeof id === "string"
              ? id
              : (newest?.version_id ?? base.version_id),
          );
          setProblem({ kind: "stale" });
        } else if (isApiError(e) && e.code === "ROLE_FORBIDDEN")
          setForbidden(true);
        else setProblem({ kind: "failed" });
        return false;
      } finally {
        inflight.current = false;
        if (alive.current) setSaving(false);
      }
    },
    [latest, load, goTo],
  );

  return {
    data,
    error,
    versions,
    latest,
    selected,
    saving,
    problem,
    message,
    forbidden,
    markForbidden: () => setForbidden(true),
    retry,
    save,
  };
}
