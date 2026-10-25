"use client";
// SCR-9 footer action bar. Contract for the page (NL-62):
//  - every issue card carries `data-issue-card` and is focusable (the disabled Submit moves focus to the first one);
//  - call `onLessonChanged` to re-read the lesson and its issues after any change the bar makes;
//  - mount `useReviewHeartbeat` yourself (it is page-level, not bar-level);
//  - mount `WorkspaceActionsProvider` once around the page so an Undo toast outlives the row that raised it.
// The server decides eligibility; this bar shows its reasons and hides actions the role cannot use.
import { useEffect, useId, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useSession } from "@/features/frame/session-context";
import { isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { lessonKeyFromId, unitKeyFromId } from "@/lib/keys";
import { stateOf, submitVector, type ClientStateInput } from "./client-state";
import { COLLAB_DOWN, DISCLOSURE, REVIEWER_NOTE, submittedToast, withdrawnToast } from "./copy";
import { MoreMenu } from "./more-menu";
import { RegenerateButton } from "./regenerate-panel";
import { blockingCount, firstIssueSelector, submitReasons } from "./submit-reasons";
import { ToastHostBoundary, useWorkspaceToast } from "./toast-host";
import { postTransition, refusalMessage } from "./transitions";

export interface WorkspaceActionBarProps {
  lesson: components["schemas"]["Lesson"];
  issues: components["schemas"]["IssueList"];
  clientState: ClientStateInput;
  onLessonChanged?: () => void;
  onFocusFirstIssue?: () => void;
  onOpenAssist?: () => void;
}

export function WorkspaceActionBar(props: WorkspaceActionBarProps) {
  return (
    <ToastHostBoundary>
      <Bar {...props} />
    </ToastHostBoundary>
  );
}

export const NOT_STORED_HOLD_MS = 3000;
const SUBMITTABLE = ["draft", "in_review", "changes_requested", "reopened"];

function Bar({ lesson, issues, clientState, onLessonChanged, onFocusFirstIssue, onOpenAssist }: WorkspaceActionBarProps) {
  const { role } = useSession();
  const toast = useWorkspaceToast();
  const announce = useAnnounce();
  const reasonsId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  // The server said "not stored yet" for this editor state. The state is often a bare string that does not change,
  // so the hold also ends after a short wait (the lesson is re-read meanwhile) and Submit can be tried again.
  const [notStoredFor, setNotStoredFor] = useState<ClientStateInput | null>(null);
  const serverNotStored = notStoredFor !== null && Object.is(notStoredFor, clientState);
  useEffect(() => {
    if (notStoredFor === null) return;
    const t = setTimeout(() => setNotStoredFor(null), NOT_STORED_HOLD_MS);
    return () => clearTimeout(t);
  }, [notStoredFor]);
  const [startedNote, setStartedNote] = useState(false);
  const attempted = useRef<string | null>(null);

  const id = lesson.lesson_id;
  const isReviewer = role === "reviewer";

  useEffect(() => {
    if (!isReviewer || lesson.state !== "draft" || attempted.current === id) return;
    attempted.current = id;
    postTransition(id, { action: "start_review" })
      .then(() => {
        setStartedNote(true);
        announce(REVIEWER_NOTE);
      })
      .catch((e: unknown) => setRefusal(isApiError(e) ? refusalMessage(e) : COLLAB_DOWN))
      .finally(() => onLessonChanged?.());
    // Fired once per lesson; the ref guard makes the StrictMode double effect harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewer, lesson.state, id]);

  const unitKey = unitKeyFromId(id.split(".").slice(0, 2).join("."));
  const lessonKey = lessonKeyFromId(id);
  const history = unitKey && lessonKey ? `/units/${unitKey}/lessons/${lessonKey}/history` : null;
  const reasons = submitReasons(issues, clientState, serverNotStored);
  const blocking = blockingCount(issues);
  const focusFirst = onFocusFirstIssue ?? (() => document.querySelector<HTMLElement>(firstIssueSelector)?.focus());

  async function submit() {
    setSubmitting(true);
    setRefusal(null);
    try {
      await postTransition(id, { action: "submit", client_state_vector: submitVector(clientState, lesson) });
      toast.show({ message: submittedToast(lesson) });
      announce(submittedToast(lesson));
      onLessonChanged?.();
    } catch (e) {
      if (isApiError(e) && e.code === "NOT_STORED") setNotStoredFor(clientState);
      else setRefusal(isApiError(e) ? refusalMessage(e) : COLLAB_DOWN);
      onLessonChanged?.();
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await postTransition(id, { action: "withdraw" });
      toast.show({ message: withdrawnToast(lesson) });
      announce(withdrawnToast(lesson));
      onLessonChanged?.();
    } catch (e) {
      setWithdrawError(isApiError(e) ? (e.code === "COLLAB_UNAVAILABLE" ? COLLAB_DOWN : e.message) : COLLAB_DOWN);
    } finally {
      setWithdrawing(false);
    }
  }

  const canEdit = isReviewer && SUBMITTABLE.includes(lesson.state);
  const failed = isReviewer && lesson.state === "generation_failed";
  const frozen = isReviewer && lesson.state === "submitted";
  const regen = (variant: "primary" | "secondary") => (
    <RegenerateButton lesson={lesson} unitKey={unitKey} lessonKey={lessonKey} variant={variant} onChanged={() => onLessonChanged?.()} />
  );
  const historyLink = history ? (
    <Link href={history} className="px-2">
      History
    </Link>
  ) : null;

  return (
    <footer
      aria-label="Lesson actions"
      data-testid="action-bar"
      data-client-state={stateOf(clientState)}
      className="bg-panel border-hair sticky bottom-0 mt-6 flex flex-col gap-3 border-t py-3"
    >
      {refusal ? <Banner level="blocking" title={refusal} /> : null}
      {withdrawError ? <Banner level="blocking" title={withdrawError} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-small text-ink2 max-w-md">{DISCLOSURE}</p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div role="status" aria-live="polite" className="text-small text-ink2">
            <p>{blocking === 0 ? "No blocking issues" : `${blocking} blocking issue${blocking === 1 ? "" : "s"}`}</p>
            {startedNote ? (
              <p data-testid="reviewer-note" className="text-small text-ink2">
                {REVIEWER_NOTE}
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex flex-col items-end gap-1">
              <span onClick={() => reasons.length > 0 && focusFirst()}>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={reasons.length > 0}
                  aria-describedby={reasonsId}
                  loading={submitting}
                  onClick={() => void submit()}
                >
                  Submit for approval
                </Button>
              </span>
              <ul id={reasonsId} data-testid="submit-reasons" className="text-small text-ink2 text-right">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {failed ? regen("primary") : null}
          {canEdit ? regen("secondary") : null}
          {frozen ? (
            <Button variant="secondary" size="lg" loading={withdrawing} onClick={() => void withdraw()}>
              Withdraw
            </Button>
          ) : null}
          {canEdit && onOpenAssist ? (
            <MoreMenu>
              <Button variant="ghost" onClick={onOpenAssist}>
                AI assist
              </Button>
            </MoreMenu>
          ) : null}
          {historyLink}
        </div>
      </div>
    </footer>
  );
}
