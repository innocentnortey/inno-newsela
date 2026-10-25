"use client";
// Dev-only host for SCR-10: ?lesson=G6.U4.L4&slot=slot-L4-PartA-quote&open=1.
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InsertQuoteDialog } from "@/features/insert-quote/insert-quote-dialog";
import { SessionGate } from "@/features/frame/session-gate";
import { WorkspaceActionsProvider } from "@/features/workspace/actions/toast-host";
import { AnnounceProvider } from "@/lib/announce";

function Screen() {
  const params = useSearchParams();
  const lessonId = params.get("lesson") ?? "G6.U4.L4";
  const slotId = params.get("slot") ?? "slot-L4-PartA-quote";
  const [open, setOpen] = useState(params.get("open") === "1");
  return (
    <main className="bg-canvas flex min-h-screen flex-col gap-4 p-6">
      <Button onClick={() => setOpen(true)}>Insert quote</Button>
      <InsertQuoteDialog lessonId={lessonId} slotId={slotId} open={open} onClose={() => setOpen(false)} />
    </main>
  );
}

export function Harness() {
  return (
    <AnnounceProvider>
      <SessionGate>
        <WorkspaceActionsProvider>
          <Screen />
        </WorkspaceActionsProvider>
      </SessionGate>
    </AnnounceProvider>
  );
}
