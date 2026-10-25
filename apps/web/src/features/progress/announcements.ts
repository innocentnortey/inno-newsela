"use client";

import { useCallback, useEffect, useRef } from "react";
import type { components } from "@/lib/api-types";
import { useAnnounce } from "@/lib/announce";

type RunProgress = components["schemas"]["RunProgress"];

function readySentence(numbers: string[]): string {
  if (numbers.length === 1) return `Lesson ${numbers[0]} is ready`;
  const head = numbers.slice(0, -1).join(", ");
  return `Lessons ${head} and ${numbers[numbers.length - 1]} are ready`;
}

/** What a screen reader hears when `next` replaces `prev`. Nothing for the first load or for in-between tile states. */
export function describeChanges(
  prev: RunProgress | undefined,
  next: RunProgress,
): string[] {
  if (!prev) return [];
  const out: string[] = [];
  const before = new Map(prev.tiles.map((t) => [t.lesson_id, t.tile_state]));
  const nowReady = next.tiles
    .filter(
      (t) => t.tile_state === "ready" && before.get(t.lesson_id) !== "ready",
    )
    .map((t) => String(t.number ?? t.lesson_key));
  if (nowReady.length > 0) out.push(readySentence(nowReady));
  if (prev.state !== next.state) {
    const total = next.tiles.length;
    const count = (s: string) =>
      next.counts_by_tile_state[s] ??
      next.tiles.filter((t) => t.tile_state === s).length;
    if (next.state === "complete")
      out.push(`Run complete: ${count("ready")} of ${total} ready.`);
    else if (next.state === "partial")
      out.push(`Run partial: ${count("failed")} of ${total} failed.`);
    else if (next.state === "paused") out.push("Run paused.");
    else if (next.state === "capped") out.push("Run capped.");
    else if (next.state === "cancelled") out.push("Run cancelled.");
  }
  return out;
}

/** At most one announcement per `minGapMs`; later text replaces a pending one, so nothing queues up. */
export function useRateLimitedAnnounce(
  minGapMs = 5000,
): (messages: string[]) => void {
  const announce = useAnnounce();
  const lastAt = useRef(-Infinity);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (messages: string[]) => {
      if (messages.length === 0) return;
      const text = messages.join(" ");
      const now = Date.now();
      if (now - lastAt.current >= minGapMs) {
        lastAt.current = now;
        pending.current = null;
        clearTimeout(timer.current);
        timer.current = undefined;
        announce(text);
        return;
      }
      pending.current = text;
      if (timer.current) return;
      timer.current = setTimeout(
        () => {
          timer.current = undefined;
          const p = pending.current;
          pending.current = null;
          if (p) {
            lastAt.current = Date.now();
            announce(p);
          }
        },
        lastAt.current + minGapMs - now,
      );
    },
    [announce, minGapMs],
  );
}
