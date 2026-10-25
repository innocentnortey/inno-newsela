"use client";
import { ToastHostBoundary } from "@/features/workspace/actions/toast-host";
import { InsertQuoteForm } from "./insert-quote-form";

export interface InsertQuoteDialogProps {
  lessonId: string;
  slotId: string;
  open: boolean;
  onClose: () => void;
}

export function InsertQuoteDialog(props: InsertQuoteDialogProps) {
  return props.open ? (
    <ToastHostBoundary>
      <InsertQuoteForm lessonId={props.lessonId} slotId={props.slotId} onClose={props.onClose} />
    </ToastHostBoundary>
  ) : null;
}
