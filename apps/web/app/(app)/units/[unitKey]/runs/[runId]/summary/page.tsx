import { RunSummaryScreen } from "@/features/run-summary/run-summary-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string; runId: string }>;
}) {
  const { unitKey, runId } = await params;
  return <RunSummaryScreen key={runId} unitKey={unitKey} runId={runId} />;
}
