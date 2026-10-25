"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Announce = (message: string) => void;
const AnnounceContext = createContext<Announce>(() => {});

/** One polite live region for the whole app; messages are debounced so a burst reads once. */
export function AnnounceProvider({ children, debounceMs = 150 }: { children: ReactNode; debounceMs?: number }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const announce = useCallback<Announce>(
    (next) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(next), debounceMs);
    },
    [debounceMs],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="announcer">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
