import { ProgressScreen } from "@/features/progress/progress-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string; runId: string }>;
}) {
  const { unitKey, runId } = await params;
  return <ProgressScreen unitKey={unitKey} runId={runId} />;
}
