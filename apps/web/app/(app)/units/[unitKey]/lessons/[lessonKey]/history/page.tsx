import { Suspense } from "react";
import { NotFound } from "@/features/frame/conventions";
import { HistoryScreen } from "@/features/history/history-screen";
import { HistorySkeleton } from "@/features/history/history-skeleton";
import { lessonIdFromKey } from "@/lib/keys";

export default async function Page({
  params,
}: {
  params: Promise<{ unitKey: string; lessonKey: string }>;
}) {
  const { unitKey, lessonKey } = await params;
  const lessonId = lessonIdFromKey(unitKey, lessonKey);
  if (!lessonId)
    return <NotFound what="lesson" boardHref="/units" where="this unit" />;
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryScreen
        unitKey={unitKey}
        lessonKey={lessonKey}
        lessonId={lessonId}
      />
    </Suspense>
  );
}
