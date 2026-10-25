"use client";

import { useEffect, useRef } from "react";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import type { LessonState } from "./board-state";

type BoardRow = components["schemas"]["BoardRow"];

export function useBoardAnnouncements(args: {
  filter: LessonState | null;
  rows: BoardRow[] | undefined;
  runState: string | undefined;
}): void {
  const announce = useAnnounce();
  const seen = useRef<Set<string> | null>(null);
  const lastRun = useRef<string | undefined>(undefined);
  const { filter, rows, runState } = args;

  useEffect(() => {
    if (!rows || filter !== null) return;
    if (seen.current === null) {
      seen.current = new Set(rows.map((r) => r.lesson_id));
      return;
    }
    for (const r of rows) {
      if (!seen.current.has(r.lesson_id)) {
        seen.current.add(r.lesson_id);
        announce(`Lesson ${r.number ?? r.lesson_key} is ready`);
      }
    }
  }, [rows, filter, announce]);

  useEffect(() => {
    if (runState === undefined) return;
    if (lastRun.current !== undefined && lastRun.current !== runState) announce(`Run ${runState}`);
    lastRun.current = runState;
  }, [runState, announce]);
}
