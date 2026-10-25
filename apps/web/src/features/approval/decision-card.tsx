"use client";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioGroup } from "@/components/ui/choice";
import { SideRail } from "@/components/layout/two-pane";
import { ForbiddenBanner, RoleNote } from "@/features/frame/conventions";
import { can, type Role } from "@/lib/roles";
import type { ApproveAction } from "./use-approve-action";
import { COPY } from "./copy";
import { RATINGS, shortHash, type Lesson, type ScreenMode } from "./derive";

export interface DecisionCardProps {
  mode: ScreenMode;
  role: Role;
  lesson: Lesson;
  action: ApproveAction;
  disabledReason: string | null;
  frozen: { name: string | null; on: string | null; exported: boolean };
  onRequestChanges: () => void;
  onReopen: () => void;
  stale: boolean;
}

function Pin() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="mr-1 inline size-3">
      <path d="M4 1h4l-1 4 2 2H3l2-2zM6 7v4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function DecisionCard(p: DecisionCardProps) {
  const { action, lesson, role } = p;
  const view = action.view;
  if (p.mode === "frozen") {
    return (
      <SideRail title={COPY.decisionTitle}>
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-ink">{COPY.approvedOn(p.frozen.name ?? "an approver", p.frozen.on)}</p>
          {p.frozen.exported ? <p className="text-small text-ink2">{COPY.exportedLine}</p> : null}
          {can(role, "reopen_lesson") ? (
            <Button variant="secondary" onClick={p.onReopen}>{COPY.reopen}</Button>
          ) : null}
        </div>
      </SideRail>
    );
  }
  if (!can(role, "approve_lesson")) {
    return (
      <SideRail title={COPY.decisionTitle}>
        <RoleNote>{COPY.onlyApprovers}</RoleNote>
      </SideRail>
    );
  }
  const busy = p.stale || action.submitting;
  const ratingMissing = view?.kind === "rating";
  const short = lesson.snapshot ? shortHash(lesson.snapshot.content_hash) : "";
  return (
    <SideRail title={COPY.decisionTitle}>
      <div className="flex flex-col gap-3">
        {view?.kind === "four_eyes" ? (
          <Banner level="advisory" title={COPY.fourEyesNo} />
        ) : (
          <Banner level="success" title={COPY.fourEyesOk}>{COPY.fourEyesOkBody}</Banner>
        )}
        {view?.kind === "forbidden" ? <ForbiddenBanner message={COPY.onlyApprovers} /> : null}
        <RadioGroup legend={COPY.ratingLegend} required>
          {RATINGS.map((r, i) => (
            <RadioCard
              key={r.value}
              ref={i === 0 ? action.firstRadioRef : undefined}
              name="rating"
              value={r.value}
              label={r.label}
              checked={action.rating === r.value}
              disabled={busy}
              onChange={() => action.setRating(r.value)}
              {...(i === 0 && ratingMissing ? { "aria-describedby": "rating-error", "aria-invalid": true } : {})}
            />
          ))}
        </RadioGroup>
        {ratingMissing ? (
          <p id="rating-error" className="text-small text-danger">{COPY.ratingError}</p>
        ) : null}
        <div className="flex flex-col items-start gap-2">
          <Button
            variant="primary"
            size="lg"
            disabled={p.disabledReason !== null || p.stale}
            disabledReason={p.disabledReason ?? undefined}
            loading={action.submitting}
            onClick={() => void action.approve()}
          >
            {COPY.approve}
          </Button>
          <Button variant="secondary" size="lg" disabled={p.stale} onClick={p.onRequestChanges}>
            {COPY.requestChanges}
          </Button>
        </div>
        {view?.kind === "network" ? <p role="alert" className="text-small text-danger">{COPY.network}</p> : null}
        {view?.kind === "other" ? <p role="alert" className="text-small text-danger">{view.message}</p> : null}
        <p className="text-small text-ink2"><Pin />{COPY.pinSmall(short)}</p>
      </div>
    </SideRail>
  );
}
