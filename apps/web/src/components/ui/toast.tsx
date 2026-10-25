"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ToastProps {
  message: string;
  action?: { label: string; onAction: () => void };
  onDismiss?: () => void;
  durationMs?: number;
}

export function Toast({ message, action, onDismiss, durationMs = 6000 }: ToastProps) {
  const [paused, setPaused] = useState(false);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => dismissRef.current?.(), durationMs);
    return () => clearTimeout(t);
  }, [paused, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="bg-overlay shadow-e3 flex max-w-[360px] items-center gap-3 rounded-lg px-4 py-3"
    >
      <svg aria-hidden="true" focusable="false" data-glyph="circle-check" viewBox="0 0 12 12" className="text-success size-3 shrink-0">
        <circle cx="6" cy="6" r="5.5" fill="currentColor" />
        <path d="m3.5 6.2 1.7 1.7 3.3-3.6" fill="none" stroke="var(--color-panel)" strokeWidth="1.3" />
      </svg>
      <p className="text-small text-ink">{message}</p>
      {action ? (
        <button type="button" onClick={action.onAction} className="text-small text-primary ml-auto font-semibold">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastRegion({ children }: { children?: ReactNode }) {
  return <div className="fixed right-4 bottom-4 z-(--z-toast) flex flex-col gap-2">{children}</div>;
}
