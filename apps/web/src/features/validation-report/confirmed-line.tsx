"use client";

import { Button } from "@/components/ui/button";
import { Glyph } from "@/components/ui/glyph";
import { choiceFailedCopy, formatClock, type ReportActions, type TargetStatus } from "./report-model";

export function ConfirmedLine({
  by,
  at,
  canEdit,
  undoLabel,
  targetId,
  actions,
}: {
  by: string | null;
  at: string | null;
  canEdit: boolean;
  undoLabel: string;
  targetId: string;
  actions: ReportActions;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-small text-ink inline-flex items-center gap-1.5">
        <span className="text-success">
          <Glyph shape="circle-check" />
        </span>
        {`Confirmed by ${by ?? "someone"}${at ? ` · ${formatClock(at)}` : ""}`}
      </span>
      {canEdit ? (
        <Button variant="ghost" size="sm" aria-label={undoLabel} onClick={() => void actions.undo(targetId)}>
          Undo
        </Button>
      ) : null}
    </div>
  );
}

/** The failure line under a control: generic copy with Try again, or the server's own sentence. */
export function FailureLine({ status, targetId, actions }: { status: TargetStatus | undefined; targetId: string; actions: ReportActions }) {
  if (!status || status.phase !== "failed") return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <p role="alert" className="text-small text-danger">
        {status.message ?? choiceFailedCopy}
      </p>
      {status.message === null ? (
        <Button variant="ghost" size="sm" onClick={() => void actions.retry(targetId)}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
