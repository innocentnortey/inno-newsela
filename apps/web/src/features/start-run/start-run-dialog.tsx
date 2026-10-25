"use client";
// Shell. Body owned by NL-58 after this ticket.
import { DialogShell } from "@/components/ui/dialog-shell";

export interface StartRunDialogProps {
  outlineVersionId: string;
  open: boolean;
  onClose: () => void;
}

export function StartRunDialog(props: StartRunDialogProps) {
  return (
    <DialogShell
      open={props.open}
      onOpenChange={(o) => !o && props.onClose()}
      title="Start a run"
    >
      <p>Built by NL-58.</p>
    </DialogShell>
  );
}
