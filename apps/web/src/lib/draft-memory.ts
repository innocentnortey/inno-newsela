"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";

// In memory only (never sessionStorage/localStorage): survives a client-side hop to /sign-in and back, not a reload.
const drafts = new Map<string, string>();

export function draftKey(pathname: string, field: string): string {
  return `${pathname}::${field}`;
}
export function saveDraft(key: string, text: string): void {
  drafts.set(key, text);
}
export function loadDraft(key: string): string | undefined {
  return drafts.get(key);
}
export function clearDraft(key: string): void {
  drafts.delete(key);
}
export function clearAllDrafts(): void {
  drafts.clear();
}

export function useDraft(field: string): [value: string, setValue: (v: string) => void, clear: () => void] {
  const key = draftKey(usePathname() ?? "", field);
  const [value, setValueState] = useState(() => loadDraft(key) ?? "");
  const setValue = useCallback(
    (v: string) => {
      setValueState(v);
      saveDraft(key, v);
    },
    [key],
  );
  const clear = useCallback(() => {
    setValueState("");
    clearDraft(key);
  }, [key]);
  return [value, setValue, clear];
}
