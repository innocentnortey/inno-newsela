import { Suspense } from "react";
import { UnitPlanScreen } from "@/features/unit-plan/unit-plan-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string; runId: string }>;
}) {
  const { unitKey, runId } = await params;
  return (
    <Suspense>
      <UnitPlanScreen unitKey={unitKey} runId={runId} />
    </Suspense>
  );
}
