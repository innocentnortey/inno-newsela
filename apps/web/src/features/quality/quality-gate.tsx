import type { ReactNode } from "react";
import { NotFound } from "@/features/frame/conventions";
import { FIRED_CUTS } from "@/features/frame/nav";

/** Cut #6: while the flag stands the route shows not-found. */
export function QualityGate({
  fired = FIRED_CUTS,
  children,
}: {
  fired?: readonly number[];
  children: ReactNode;
}) {
  if (fired.includes(6)) return <NotFound what="page" />;
  return <>{children}</>;
}
