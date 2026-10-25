"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, isApiError, setUnauthenticatedHandler } from "@/lib/api-client";
import { CantLoad } from "./conventions";
import { SessionProvider, type SessionValue } from "./session-context";

type State = { kind: "loading" } | { kind: "ready"; value: SessionValue } | { kind: "error" } | { kind: "redirect" };

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const search = useSearchParams()?.toString() ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [showLoading, setShowLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const redirect = useCallback(() => {
    const here = pathname + (search ? `?${search}` : "");
    router.replace("/sign-in?next=" + encodeURIComponent(here));
  }, [router, pathname, search]);

  useEffect(() => {
    setUnauthenticatedHandler(redirect);
    return () => setUnauthenticatedHandler(null);
  }, [redirect]);

  useEffect(() => {
    let alive = true;
    api
      .GET("/session")
      .then(({ data }) => {
        if (alive && data) setState({ kind: "ready", value: { user: data.user, role: data.user.role } });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (isApiError(e) && e.code === "UNAUTHENTICATED") {
          setState({ kind: "redirect" });
          redirect();
        } else setState({ kind: "error" });
      });
    return () => {
      alive = false;
    };
    // The session is read once per mount/retry; a path change must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    const t = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (state.kind === "ready") return <SessionProvider value={state.value}>{children}</SessionProvider>;
  if (state.kind === "error") {
    return (
      <main className="p-6">
        <CantLoad
          thing="your session"
          onRetry={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        />
      </main>
    );
  }
  return (
    <main aria-busy="true" className="p-6 text-body text-ink2">
      {state.kind === "loading" && showLoading ? "Loading…" : null}
    </main>
  );
}
