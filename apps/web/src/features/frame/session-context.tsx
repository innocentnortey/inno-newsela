"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";

export interface SessionValue {
  user: components["schemas"]["User"];
  role: Role;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
