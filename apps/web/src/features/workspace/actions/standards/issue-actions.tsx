"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { InsertQuoteDialog } from "@/features/insert-quote/insert-quote-dialog";
import { ResolveDialog } from "@/features/resolve/resolve-dialog";
import { useSession } from "@/features/frame/session-context";
import type { components } from "@/lib/api-types";
import { IssueOpenerButtons } from "../standard-decision";
import { flagIdFor } from "./flag-id";
import { SLOT_KINDS, slotIdFor } from "./slot-for-issue";

type Issue = components["schemas"]["Issue"];
type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];

export interface IssueActionsProps {
  issue: Issue;
  lesson: Lesson;
  issues: IssueList;
  /** The parent re-reads the lesson and its issues. */
  onChanged: () => void;
}

type Dialog = { kind: "resolve" | "clear_flag" | "slot"; flagId?: string; slotId?: string };

/** The rail card's actions: Resolve…, Clear flag… and Insert quote or excerpt… (seam S-22). Server stays the authority. */
export function IssueActions({ issue, lesson, issues, onChanged }: IssueActionsProps): ReactNode {
  const { role } = useSession();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const open = issue.resolution === null;
  const flagId = flagIdFor(issue);
  const slotId = SLOT_KINDS.includes(issue.kind) ? slotIdFor(issue, lesson.sections, issues.issues.filter((i) => SLOT_KINDS.includes(i.kind))) : null;
  const showSlot = role === "reviewer" && open && slotId !== null;
  const close = () => setDialog(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* No parsable flag id: hide Clear flag… by passing the opener a kind it does not act on (never send a wrong id). */}
        <IssueOpenerButtons
          issue={flagId === null && issue.kind === "safety_flag_open" ? { ...issue, kind: "standard_confirmation" } : issue}
          onResolve={() => setDialog({ kind: "resolve" })}
          onClearFlag={() => flagId && setDialog({ kind: "clear_flag", flagId })}
        />
        {showSlot ? (
          <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "slot", slotId: slotId ?? undefined })}>
            Insert quote or excerpt…
          </Button>
        ) : null}
      </div>
      {dialog && dialog.kind !== "slot" ? (
        <ResolveDialog
          lessonId={lesson.lesson_id}
          mode={dialog.kind}
          issueId={dialog.kind === "resolve" ? issue.issue_id : undefined}
          flagId={dialog.flagId}
          open
          onClose={close}
          onResolved={onChanged}
        />
      ) : null}
      {dialog?.kind === "slot" && dialog.slotId ? (
        <InsertQuoteDialog lessonId={lesson.lesson_id} slotId={dialog.slotId} open onClose={close} onFilled={onChanged} />
      ) : null}
    </>
  );
}
