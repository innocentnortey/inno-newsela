"use client";
import { StartRunForm } from "./start-run-form";

export interface StartRunDialogProps {
  outlineVersionId: string;
  open: boolean;
  onClose: () => void;
}

/** The form is mounted only while open, so every open starts from fresh state. */
export function StartRunDialog({ outlineVersionId, open, onClose }: StartRunDialogProps) {
  return open ? <StartRunForm outlineVersionId={outlineVersionId} onClose={onClose} /> : null;
}
