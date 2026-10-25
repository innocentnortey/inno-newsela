"use client";
// Shell. Body owned by NL-65 after this ticket.
import { DialogShell } from "@/components/ui/dialog-shell";

export interface InsertQuoteDialogProps {
  lessonId: string;
  slotId: string;
  open: boolean;
  onClose: () => void;
}

export function InsertQuoteDialog(props: InsertQuoteDialogProps) {
  return (
    <DialogShell
      open={props.open}
      onOpenChange={(o) => !o && props.onClose()}
      title="Insert quote or excerpt"
    >
      <p>Built by NL-65.</p>
    </DialogShell>
  );
}
