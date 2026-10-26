"use client";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { DisabledReason } from "@/features/frame/conventions";
import { COPY, makingMessage, trialMessage } from "./copy";
import { useTrial } from "./use-trial";

export function TrialPanel({
  promptVersionId,
  isLatest,
  onForbidden,
}: {
  promptVersionId: string;
  isLatest: boolean;
  onForbidden: () => void;
}) {
  const t = useTrial({ promptVersionId, onForbidden });
  const reason = !isLatest
    ? COPY.selectLatest
    : t.lessons && !t.outlineId
      ? COPY.noOutline
      : null;
  const r = t.result;
  return (
    <section aria-labelledby="pg-trial" className="flex flex-col gap-3">
      <h2 id="pg-trial" className="text-ink text-lg font-semibold">
        {COPY.trialTitle}
      </h2>
      {t.loadError ? (
        <div className="flex items-center gap-3 text-body text-ink">
          <span>{COPY.lessonsFailed}</span>
          <Button variant="secondary" onClick={t.retry}>
            {COPY.retry}
          </Button>
        </div>
      ) : (
        <Select
          label={COPY.lessonLabel}
          value={t.lessonId}
          disabled={!t.lessons || t.busy}
          onChange={(e) => t.setLessonId(e.target.value)}
        >
          <option value="">{COPY.lessonPlaceholder}</option>
          {t.lessons?.map((l) => (
            <option key={l.lessonId} value={l.lessonId}>
              {l.label}
            </option>
          ))}
        </Select>
      )}
      <div className="flex flex-col items-start gap-2">
        <Button
          loading={t.busy}
          disabled={!!reason || !t.lessonId}
          aria-describedby={reason ? "pg-trial-reason" : undefined}
          onClick={() => void t.start()}
        >
          {COPY.trialButton}
        </Button>
        {reason ? (
          <DisabledReason id="pg-trial-reason">{reason}</DisabledReason>
        ) : null}
        <div role="status" className="text-body text-ink">
          {r?.kind === "making" ? makingMessage(r.number) : null}
          {r?.kind === "made" ? (
            <>
              <span>{trialMessage(r.number)} </span>
              <Link
                href={`/units/g6-u4/lessons/${r.lessonKey}/candidates/${r.candidateId}`}
              >
                {COPY.compare}
              </Link>
            </>
          ) : null}
          {r?.kind === "slow" ? (
            <>
              <span>{COPY.trialSlow} </span>
              <Link href={`/units/g6-u4/lessons/${r.lessonKey}/history`}>
                {COPY.openHistory}
              </Link>
            </>
          ) : null}
        </div>
      </div>
      {t.problem ? <Banner level="blocking" title={t.problem} /> : null}
    </section>
  );
}
