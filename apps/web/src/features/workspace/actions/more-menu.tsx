"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** A plain disclosure (no menu role, so no arrow-key obligations): opens upward from the sticky footer. */
export function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button ref={trigger} variant="secondary" size="lg" aria-haspopup="true" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        More
      </Button>
      {open ? (
        <div id={panelId} role="group" aria-label="More actions" className="bg-overlay shadow-e3 absolute right-0 bottom-full mb-2 flex min-w-48 flex-col gap-1 rounded-lg p-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
