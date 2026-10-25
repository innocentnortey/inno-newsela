import { Suspense } from "react";
import { CandidateScreen } from "@/features/candidate/candidate-screen";

export default async function Page({ params }: { params: Promise<{ unitKey: string; lessonKey: string; candidate: string }> }) {
  const { unitKey, lessonKey, candidate } = await params;
  return (
    <Suspense>
      <CandidateScreen unitKey={unitKey} lessonKey={lessonKey} candidateId={candidate} />
    </Suspense>
  );
}
