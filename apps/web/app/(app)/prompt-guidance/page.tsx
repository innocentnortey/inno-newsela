import { Suspense } from "react";
import { PromptGuidanceScreen } from "@/features/prompt-guidance/prompt-guidance-screen";

export default function Page() {
  return (
    <Suspense>
      <PromptGuidanceScreen />
    </Suspense>
  );
}
