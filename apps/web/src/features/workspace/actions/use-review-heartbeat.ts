"use client";
// CON-20 sender: every 15 s while the lesson is open, focused, visible and touched in the last 60 s.
// Sends only the contract fields. It never counts or holds minutes; the server does that.
import { useEffect } from "react";
import { useSession } from "@/features/frame/session-context";
import { api } from "@/lib/api-client";

export const HEARTBEAT_MS = 15_000;
export const IDLE_MS = 60_000;
const TOUCH_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart", "input"] as const;

let fallbackTabId: string | null = null;
function tabId(): string {
  try {
    const kept = window.sessionStorage.getItem("ls.tab_id");
    if (kept) return kept;
    const made = `tab-${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}`;
    window.sessionStorage.setItem("ls.tab_id", made);
    return made;
  } catch {
    fallbackTabId ??= `tab-${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}`;
    return fallbackTabId;
  }
}

export function useReviewHeartbeat(args: { lessonId: string; versionId: string }): void {
  const { role } = useSession();
  const active = role === "reviewer" || role === "approver";
  const { lessonId, versionId } = args;

  useEffect(() => {
    if (!active) return;
    let lastInput = Date.now();
    let inFlight = false;
    const touch = () => {
      lastInput = Date.now();
    };
    for (const ev of TOUCH_EVENTS) window.addEventListener(ev, touch, { passive: true });

    const tick = () => {
      const visible = document.visibilityState === "visible";
      const focused = document.hasFocus();
      if (!visible || !focused || Date.now() - lastInput > IDLE_MS || inFlight) return;
      inFlight = true;
      api
        .POST("/lessons/{lessonId}/heartbeats", {
          params: { path: { lessonId } },
          body: {
            tab_id: tabId(),
            focused,
            visible,
            last_input_at: new Date(lastInput).toISOString(),
            sent_at: new Date().toISOString(),
            version_id: versionId,
          },
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };
    const timer = setInterval(tick, HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      for (const ev of TOUCH_EVENTS) window.removeEventListener(ev, touch);
    };
  }, [active, lessonId, versionId]);
}
