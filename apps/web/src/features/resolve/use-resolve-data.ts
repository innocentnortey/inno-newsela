"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

/** Reads the issue sentence (and, for a safety flag, the outline's teacher tip). A failed read leaves both null; the server stays the authority. */
export function useResolveData(lessonId: string, targetId: string | undefined, mode: "resolve" | "clear_flag", open: boolean) {
  const [data, setData] = useState<{ issueMessage: string | null; tip: string | null }>({ issueMessage: null, tip: null });
  useEffect(() => {
    if (!open || !targetId) return;
    let alive = true;
    const path = { params: { path: { lessonId } } };
    (async () => {
      let issueMessage: string | null = null;
      let tip: string | null = null;
      try {
        const { data: list } = await api.GET("/lessons/{lessonId}/issues", path);
        issueMessage = list?.issues.find((i) => i.issue_id === targetId)?.message ?? null;
      } catch {}
      if (mode === "clear_flag") {
        try {
          const { data: lesson } = await api.GET("/lessons/{lessonId}", path);
          tip = lesson?.outline_row.segments.find((s) => s.kind === "safety_note")?.text ?? null;
        } catch {}
      }
      if (alive) setData({ issueMessage, tip });
    })();
    return () => {
      alive = false;
    };
  }, [lessonId, targetId, mode, open]);
  return data;
}
