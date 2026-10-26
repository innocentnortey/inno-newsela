import { QualityScreen } from "@/features/quality/quality-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string }>;
}) {
  const { unitKey } = await params;
  return <QualityScreen key={unitKey} unitKey={unitKey} />;
}
