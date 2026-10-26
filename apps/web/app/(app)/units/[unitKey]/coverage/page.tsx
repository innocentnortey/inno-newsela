import { Suspense } from "react";
import { CoverageScreen } from "@/features/coverage/coverage-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string }>;
}) {
  const { unitKey } = await params;
  return (
    <Suspense>
      <CoverageScreen key={unitKey} unitKey={unitKey} />
    </Suspense>
  );
}
