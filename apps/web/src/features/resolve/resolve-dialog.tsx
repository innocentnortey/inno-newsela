"use client";
import { ResolveBody } from "./resolve-body";

export interface ResolveDialogProps {
  lessonId: string;
  mode: "resolve" | "clear_flag";
  issueId?: string;
  flagId?: string;
  open: boolean;
  onClose: () => void;
  /** Called after a successful call so the rail re-reads issues. */
  onResolved?: () => void;
}

export function ResolveDialog({ open, ...rest }: ResolveDialogProps) {
  return open ? <ResolveBody {...rest} /> : null;
}
