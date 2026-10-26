"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { initials_of } from "@/editor/presence";
import { readTheme, saveTheme, THEME_CHOICES, THEME_LABEL, type ThemeChoice } from "@/lib/theme";

/** The account menu (design.md §4, top bar right; DQ-4 theme choice). A plain disclosure, like the footer's More. */
export function AccountMenu({ name, roleLabel, busy, onSignOut }: { name: string; roleLabel: string; busy: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>("light");
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

  const choose = (t: ThemeChoice) => {
    setTheme(t);
    saveTheme(t);
  };

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(e) => {
        if (open && !root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Account: ${name}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // The stored choice is read when the menu opens; it is the only place it is shown.
          if (!open) setTheme(readTheme());
          setOpen((o) => !o);
        }}
        className="bg-well text-ink2 text-label flex size-8 items-center justify-center rounded-full font-semibold"
      >
        <span aria-hidden="true">{initials_of(name)}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label="Account"
          className="bg-overlay border-hair shadow-e3 absolute top-full right-0 z-[var(--z-popover)] mt-2 flex w-60 flex-col gap-3 rounded-lg border p-3"
        >
          <div>
            <p className="text-small text-ink font-semibold">{name}</p>
            <p className="text-label text-ink2">{roleLabel}</p>
          </div>
          <fieldset className="border-hair flex flex-col gap-1 border-t pt-3">
            <legend className="text-label text-ink3 mb-1 font-semibold">Theme</legend>
            {THEME_CHOICES.map((t) => (
              <label key={t} className="text-small text-ink flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-well">
                <input type="radio" name={`${panelId}-theme`} value={t} checked={theme === t} onChange={() => choose(t)} className="accent-[var(--color-primary)]" />
                {THEME_LABEL[t]}
              </label>
            ))}
          </fieldset>
          <div className="border-hair border-t pt-3">
            <Button variant="secondary" size="sm" loading={busy} onClick={onSignOut} className="w-full">
              Sign out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
