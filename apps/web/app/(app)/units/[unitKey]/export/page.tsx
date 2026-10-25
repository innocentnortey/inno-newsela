import { Suspense } from "react";
import { ExportScreen } from "@/features/export/export-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string }>;
}) {
  const { unitKey } = await params;
  return (
    <Suspense>
      <ExportScreen key={unitKey} unitKey={unitKey} />
    </Suspense>
  );
}
