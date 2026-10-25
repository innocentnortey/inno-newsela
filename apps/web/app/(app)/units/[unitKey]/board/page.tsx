import { Suspense } from "react";
import { BoardScreen } from "@/features/board/board-screen";

export default async function Page({ params }: { params: Promise<{ unitKey: string }> }) {
  const { unitKey } = await params;
  return (
    <Suspense>
      <BoardScreen unitKey={unitKey} />
    </Suspense>
  );
}
