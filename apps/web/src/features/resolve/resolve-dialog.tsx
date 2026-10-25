"use client";
// Shell. Body owned by NL-66 after this ticket.
import { DialogShell } from "@/components/ui/dialog-shell";

export interface ResolveDialogProps {
  lessonId: string;
  mode: "resolve" | "clear_flag";
  issueId?: string;
  flagId?: string;
  open: boolean;
  onClose: () => void;
}

export function ResolveDialog(props: ResolveDialogProps) {
  return (
    <DialogShell
      open={props.open}
      onOpenChange={(o) => !o && props.onClose()}
      title="Resolve or clear"
    >
      <p>Built by NL-66.</p>
    </DialogShell>
  );
}
