"use client";
// Shell. Body owned by NL-69 after this ticket.
import { DialogShell } from "@/components/ui/dialog-shell";

export interface SendBackDialogProps {
  lessonId: string;
  mode: "request_changes" | "reopen";
  pin: { snapshotHash: string; snapshotStateVector: string };
  open: boolean;
  onClose: () => void;
}

export function SendBackDialog(props: SendBackDialogProps) {
  return (
    <DialogShell
      open={props.open}
      onOpenChange={(o) => !o && props.onClose()}
      title="Send back or reopen"
    >
      <p>Built by NL-69.</p>
    </DialogShell>
  );
}
