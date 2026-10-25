"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StartRunDialog } from "@/features/start-run/start-run-dialog";

export function Host() {
  const [open, setOpen] = useState(false);
  return (
    <main className="p-8">
      <h1 className="text-title text-ink">Start run host (dev only)</h1>
      <Button onClick={() => setOpen(true)}>Start run</Button>
      <StartRunDialog outlineVersionId="G6.U4.ov1" open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
