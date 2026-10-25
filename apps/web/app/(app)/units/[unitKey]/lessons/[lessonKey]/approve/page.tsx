import { ApprovalScreen } from "@/features/approval/approval-screen";
import { NotFound } from "@/features/frame/conventions";
import { lessonIdFromKey } from "@/lib/keys";

export default async function Page({ params }: { params: Promise<{ unitKey: string; lessonKey: string }> }) {
  const { unitKey, lessonKey } = await params;
  const lessonId = lessonIdFromKey(unitKey, lessonKey);
  if (!lessonId) return <NotFound what="lesson" boardHref="/units" where="this unit" />;
  return <ApprovalScreen unitKey={unitKey} lessonKey={lessonKey} lessonId={lessonId} />;
}
