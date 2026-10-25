import { WorkspaceScreen } from "@/features/workspace/workspace-screen";

export default async function Page({ params }: { params: Promise<{ unitKey: string; lessonKey: string }> }) {
  const { unitKey, lessonKey } = await params;
  return <WorkspaceScreen unitKey={unitKey} lessonKey={lessonKey} />;
}
