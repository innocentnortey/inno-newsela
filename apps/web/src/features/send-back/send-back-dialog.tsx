"use client";
import { DialogShell } from "@/components/ui/dialog-shell";
import { dialogTitle } from "./copy";
import { SendBackForm } from "./send-back-form";

export interface SendBackDialogProps {
  lessonId: string;
  mode: "request_changes" | "reopen";
  pin: { snapshotHash: string; snapshotStateVector: string };
  open: boolean;
  onClose: () => void;
  onDone?: (r: { kind: "sent_back" | "reopened"; versionNumber: number }) => void;
  onStale?: () => void;
}

export function SendBackDialog(props: SendBackDialogProps) {
  return props.open ? (
    <SendBackForm key={`${props.mode}:${props.lessonId}`} {...props} />
  ) : (
    <DialogShell open={false} title={dialogTitle(props.mode, props.lessonId)} />
  );
}
