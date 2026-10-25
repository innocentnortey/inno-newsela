"use client";
// One toast stack for the workspace. A toast with Undo must outlive the standard row that raised it (the row unmounts
// once the standard is confirmed), so the page mounts WorkspaceActionsProvider once around itself.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Toast, ToastRegion } from "@/components/ui/toast";

interface ToastItem {
  id: string;
  message: string;
  action?: { label: string; onAction: () => void };
}
interface Api {
  show: (t: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}
const Ctx = createContext<Api | null>(null);

export function WorkspaceActionsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: string) => setToasts((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `toast-${++seq.current}`;
    setToasts((l) => [...l, { ...t, id }]);
    return id;
  }, []);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastRegion>
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} action={t.action} durationMs={6000} onDismiss={() => dismiss(t.id)} />
        ))}
      </ToastRegion>
    </Ctx.Provider>
  );
}

export function useWorkspaceToast(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspaceToast needs a WorkspaceActionsProvider (or ToastHostBoundary) above it.");
  return v;
}

/** Children as-is when a provider already exists above, else wrapped in one. */
export function ToastHostBoundary({ children }: { children: ReactNode }) {
  const v = useContext(Ctx);
  return v ? <>{children}</> : <WorkspaceActionsProvider>{children}</WorkspaceActionsProvider>;
}
