"use client";
import { placeLabel } from "@/features/workspace/state-model";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import { Toast, ToastRegion } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { TwoPane } from "@/components/layout/two-pane";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { useSession } from "@/features/frame/session-context";
import { SendBackDialog } from "@/features/send-back/send-back-dialog";
import { SEND_BACK_TAG_LABEL } from "@/features/workspace/state-model";
import { DISCLOSURE } from "@/features/workspace/actions/copy";
import { useReviewHeartbeat } from "@/features/workspace/actions/use-review-heartbeat";
import { api } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import { Checklist } from "./checklist";
import { COPY } from "./copy";
import { DecisionCard } from "./decision-card";
import { ApprovalSkeleton, TextSkeleton } from "./approval-skeleton";
import {
  approveDisabledReason, checklistRows, lessonHref, lessonNumberLabel, screenMode, shortHash, stepperStep, unitLabel,
  waitingOnThis, type Lesson,
} from "./derive";
import { FrozenText } from "./frozen-text";
import { useApprovalData, type ApiClient } from "./use-approval-data";
import { useApproveAction } from "./use-approve-action";

const STATE_LABEL: Record<Lesson["state"], string> = {
  generation_failed: "Generation failed", draft: "Draft", in_review: "In review", submitted: "Submitted",
  changes_requested: "Changes requested", approved: "Approved", reopened: "Reopened", exported: "Exported",
};

function ReviewHeartbeat({ lessonId, versionId }: { lessonId: string; versionId: string }) {
  useReviewHeartbeat({ lessonId, versionId });
  return <p className="text-small text-ink2">{DISCLOSURE}</p>;
}

export interface ApprovalScreenProps {
  unitKey: string;
  lessonKey: string;
  lessonId: string;
  client?: ApiClient;
}

export function ApprovalScreen({ unitKey, lessonKey, lessonId, client }: ApprovalScreenProps) {
  const data = useApprovalData(client ?? api, lessonId);
  const n = lessonNumberLabel(lessonId);
  const board = `/units/${unitKey}/board`;
  if (data.status === "error") {
    return data.error?.code === "NOT_FOUND" ? (
      <NotFound what={`Lesson ${n}`} where={placeLabel(unitKey)} boardHref={board} />
    ) : (
      <CantLoad thing={COPY.cantLoadThing} onRetry={() => void data.reload()} />
    );
  }
  if (data.status === "loading" || !data.lesson) return <ApprovalSkeleton />;
  return <Ready {...{ unitKey, lessonKey, n, board, client: client ?? api, data }} lesson={data.lesson} />;
}

function Ready({ unitKey, lessonKey, n, board, client, data, lesson }: {
  unitKey: string; lessonKey: string; n: string; board: string; client: ApiClient;
  data: ReturnType<typeof useApprovalData>; lesson: Lesson;
}) {
  const { role, user } = useSession();
  const announce = useAnnounce();
  useSetBreadcrumb([{ label: unitLabel(lesson.unit_id), href: board }, { label: "Approvals", href: board }, { label: `Lesson ${n}` }]);
  const [toast, setToast] = useState(false);
  const [dialog, setDialog] = useState<null | "request_changes" | "reopen">(null);
  const onApproved = useCallback(() => {
    setToast(true);
    announce(COPY.toast(n));
  }, [announce, n]);
  const action = useApproveAction({ client, lesson, userName: user.name, onApproved });
  const reloadRef = useRef<HTMLButtonElement>(null);
  const staleFromDialog = useRef(false);
  const view = action.view;
  const stale = view?.kind === "stale";
  useEffect(() => {
    if (stale) reloadRef.current?.focus();
  }, [stale]);

  const mode = screenMode(lesson);
  const snapshot = lesson.snapshot;
  const short = snapshot ? shortHash(snapshot.content_hash) : "";
  const effectiveState = action.result ? "approved" : lesson.state;
  const reloadAndClear = async () => {
    await data.reload();
    action.clearView();
  };

  const approvedRow = [...(data.history?.audit ?? [])].reverse().find((r) => r.action === "approve");
  const frozen = {
    name: action.result?.name ?? approvedRow?.user ?? null,
    on: action.result?.on ?? approvedRow?.at.slice(0, 10) ?? null,
    exported: lesson.state === "exported",
  };
  const rows = checklistRows({
    lesson, unitKey, issues: data.issues?.issues ?? null, blockedIssues: view?.kind === "blocked" ? view.issues : [],
  });
  const shownMode = action.result ? "frozen" : mode;

  const meta = (
    <>
      {lesson.type} · {STATE_LABEL[effectiveState]}
      {lesson.reviewer ? ` · by ${lesson.reviewer}` : ""}
      {snapshot ? (
        <>
          {" · snapshot "}
          <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="inline size-3">
            <path d="M4 1h4l-1 4 2 2H3l2-2zM6 7v4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>{" "}
          <span aria-label={`snapshot ${short}`}>{short}</span>
        </>
      ) : null}
    </>
  );

  const header = (
    <>
      <PageHeader eyebrow={COPY.eyebrow} title={lesson.title} meta={meta} />
      <div className="flex flex-col gap-3 empty:hidden">
        {!action.result ? waitingOnThis(lesson).map((d) => (
          <Banner key={d.lessonId} level="info" title={COPY.waitingOnYou(lessonNumberLabel(d.lessonId))} />
        )) : null}
        {stale ? (
          <Banner
            level="blocking"
            title={COPY.stale}
            action={<Button ref={reloadRef} variant="secondary" onClick={() => void reloadAndClear()}>{COPY.reload}</Button>}
          />
        ) : null}
        {view?.kind === "blocked" ? <Banner level="blocking" title={COPY.blocked(view.message)} /> : null}
        {action.result ? (
          <Banner level="success" title={COPY.approvedBanner(action.result.name, action.result.short, action.result.ratingLabel)}>
            {action.result.thanks.map((id) => (
              <p key={id}>
                {COPY.nowApprovable(lessonNumberLabel(id))}{" "}
                <Link href={lessonHref(id)}>{COPY.openLesson(lessonNumberLabel(id))}</Link>
              </p>
            ))}
          </Banner>
        ) : null}
      </div>
    </>
  );
  // Look sheet M4 (SCR-14): the stepper above; one page sheet holding the header, banners, checklist and the frozen
  // text; the decision card in the rail beside it.
  const sheet = "bg-panel border-hair shadow-e2 flex min-w-0 flex-col gap-4 rounded-xl border px-7 py-6 max-sm:px-4";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Stepper
          current={stepperStep(effectiveState)}
          offPath={lesson.state === "changes_requested" ? <StatusPill status="lesson.changes_requested" /> : undefined}
        />
      </div>
      {shownMode === "not_submitted" ? (
        <section className={sheet}>
          {header}
          <div className="text-body text-ink flex flex-col items-start gap-2">
            <p>{COPY.notSubmitted(n, lesson.state, lesson.reviewer)}</p>
            {lesson.state === "changes_requested" && lesson.send_back ? (
              <p className="text-ink2">Changes requested by {lesson.send_back.by} · {SEND_BACK_TAG_LABEL[lesson.send_back.tag]}: {lesson.send_back.note}</p>
            ) : null}
            <Link href={`/units/${unitKey}/lessons/${lessonKey}`}>{COPY.openReadOnly(n)}</Link>
          </div>
        </section>
      ) : (
        <TwoPane
          rail={
            <DecisionCard
              mode={shownMode}
              role={role}
              lesson={lesson}
              action={action}
              disabledReason={approveDisabledReason({ lesson, view })}
              frozen={frozen}
              onRequestChanges={() => setDialog("request_changes")}
              onReopen={() => setDialog("reopen")}
              stale={stale}
            />
          }
        >
          <section className={sheet}>
            {header}
            <Checklist rows={rows} />
            <hr className="border-hair" />
            <h2 className="text-ink text-sm font-semibold">{COPY.textHeading(short)}</h2>
            <div className="max-w-[68ch]">{data.issuesSettled ? <FrozenText sections={lesson.sections} /> : <TextSkeleton />}</div>
          </section>
        </TwoPane>
      )}
      {toast ? (
        <ToastRegion>
          <Toast message={COPY.toast(n)} onDismiss={() => setToast(false)} />
        </ToastRegion>
      ) : null}
      {snapshot ? (
        <SendBackDialog
          lessonId={lesson.lesson_id}
          mode={dialog ?? "request_changes"}
          pin={{ snapshotHash: snapshot.content_hash, snapshotStateVector: snapshot.state_vector }}
          open={dialog !== null}
          onClose={() => {
            setDialog(null);
            // A stale pin keeps the old snapshot on screen until Reload, so the SCR-14 stale banner can show.
            if (staleFromDialog.current) staleFromDialog.current = false;
            else void data.reload();
          }}
          onStale={() => {
            staleFromDialog.current = true;
            action.markStale();
          }}
        />
      ) : null}
      {role !== "author" && snapshot ? <ReviewHeartbeat lessonId={lesson.lesson_id} versionId={snapshot.version_id} /> : null}
    </div>
  );
}
