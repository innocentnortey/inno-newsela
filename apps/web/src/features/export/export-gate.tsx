import type { ReactNode } from "react";
import { NotFound } from "@/features/frame/conventions";
import { FIRED_CUTS } from "@/features/frame/nav";

/** Cut #5: while the flag stands the route shows not-found. */
export function ExportGate({
  fired = FIRED_CUTS,
  children,
}: {
  fired?: readonly number[];
  children: ReactNode;
}) {
  if (fired.includes(5)) return <NotFound what="page" where="this app" boardHref="/units" />;
  return <>{children}</>;
}
