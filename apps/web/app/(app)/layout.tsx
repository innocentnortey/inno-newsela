import { Suspense, type ReactNode } from "react";
import { AppFrame } from "@/features/frame/app-frame";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}
