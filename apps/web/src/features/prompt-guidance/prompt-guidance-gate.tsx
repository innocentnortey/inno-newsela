import type { ReactNode } from "react";
import { NotFound } from "@/features/frame/conventions";
import { FIRED_CUTS } from "@/features/frame/nav";

/** Cut #7: while the flag stands the route shows not-found. */
export function PromptGuidanceGate({
  fired = FIRED_CUTS,
  children,
}: {
  fired?: readonly number[];
  children: ReactNode;
}) {
  if (fired.includes(7)) return <NotFound what="page" />;
  return <>{children}</>;
}
