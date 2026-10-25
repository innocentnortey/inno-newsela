import { ValidationReportScreen } from "@/features/validation-report/validation-report-screen";

export default async function Page({ params }: { params: Promise<{ unitKey: string; version: string }> }) {
  const { unitKey, version } = await params;
  return <ValidationReportScreen unitKey={unitKey} version={Number(version)} />;
}
