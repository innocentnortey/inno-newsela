"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Banner } from "@/components/ui/banner";
import { Link } from "@/components/ui/link";
import { StatusPill } from "@/components/ui/status-pill";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { useSession } from "@/features/frame/session-context";
import { ToastHostBoundary } from "@/features/workspace/actions/toast-host";
import { lessonLabel, placeLabel } from "@/features/workspace/state-model";
import { useLesson } from "@/features/workspace/use-lesson";
import { isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import { lessonIdFromKey } from "@/lib/keys";
import { CandidateHeader } from "./candidate-header";
import { CandidateSkeleton } from "./candidate-skeleton";
import { CompareView } from "./compare-view";
import { BACK, DRAFTING, HP5_NOTE, failedSentence, frozenNote } from "./copy";
import { FROZEN, alignRows, canAdopt as canAdoptNow, candidateLabel } from "./derive";
import { useAdopt } from "./use-adopt";
import { useCandidate } from "./use-candidate";
import { useWide } from "./use-wide";

export interface CandidateScreenProps {
  unitKey: string;
  lessonKey: string;
  candidateId: string;
}

export function CandidateScreen(props: CandidateScreenProps) {
  const lessonId = lessonIdFromKey(props.unitKey, props.lessonKey);
  if (!lessonId) return <NotFound what="lesson" boardHref="/units" where="this unit" />;
  return (
    <ToastHostBoundary>
      <Content {...props} lessonId={lessonId} />
    </ToastHostBoundary>
  );
}

function Content({ unitKey, lessonKey, candidateId, lessonId }: CandidateScreenProps & { lessonId: string }) {
  const { role } = useSession();
  const announce = useAnnounce();
  const wide = useWide();
  const section = useSearchParams().get("section");
  const { load, retry: retryLesson } = useLesson(lessonId);
  const { candidate, error, reload } = useCandidate(lessonId, candidateId);
  const label = lessonLabel(lessonKey);
  const lessonHref = `/units/${unitKey}/lessons/${lessonKey}`;
  const version = candidate?.version_number ?? 0;
  const vLabel = candidateLabel(version);

  useSetBreadcrumb([
    { label: "Units", href: "/units" },
    { label: placeLabel(unitKey), href: `/units/${unitKey}/board` },
    { label: label, href: lessonHref },
    { label: candidate ? vLabel : "Candidate" },
  ]);

  const refresh = useCallback(() => {
    retryLesson();
    reload();
  }, [retryLesson, reload]);
  const adopt = useAdopt({ lessonId, candidateId, version, unitKey, lessonKey, lessonLabel: label, onRefresh: refresh });

  const status = candidate?.status;
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seen.current && seen.current !== "ready" && seen.current !== "failed" && status === "ready") announce("Candidate ready.");
    seen.current = status;
  }, [status, announce]);

  const lessonReady = load.kind === "ready";
  const showCompare = lessonReady && status === "ready";
  const scrolled = useRef(false);
  useEffect(() => {
    if (!showCompare || !section || scrolled.current) return;
    const el = document.getElementById(`cmp-${section}`);
    if (!el) return;
    scrolled.current = true;
    el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
  }, [showCompare, section]);

  if (load.kind === "not_found" || (isApiError(error) && error.code === "NOT_FOUND" && !candidate)) {
    return <NotFound what={load.kind === "not_found" ? label : "candidate"} boardHref={`/units/${unitKey}/board`} where={placeLabel(unitKey)} />;
  }
  if (load.kind === "error" || (error && !candidate)) {
    return <CantLoad thing="the candidate" onRetry={() => { retryLesson(); reload(); }} />;
  }
  if (load.kind === "schema_unknown") return <CantLoad thing={label} onRetry={retryLesson} />;
  if (load.kind !== "ready" || !candidate) return <CandidateSkeleton />;

  const lesson = load.lesson;
  const allowed = canAdoptNow({ role, lessonState: lesson.state, candidate });
  const header = (
    <CandidateHeader
      versionLabel={vLabel}
      adopted={candidate.adopted}
      lessonHref={lessonHref}
      lessonLabel={label}
      canAdopt={allowed}
      notReviewer={role !== "reviewer"}
      busy={adopt.busy}
      onAdoptWhole={() => void adopt.adopt("whole")}
    />
  );

  if (candidate.status === "queued" || candidate.status === "drafting") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div role="status" data-testid="candidate-drafting" className="text-body text-ink flex flex-wrap items-center gap-3">
          <StatusPill status="tile.drafting" />
          <p>{DRAFTING}</p>
        </div>
        <Link href={lessonHref}>{BACK(label)}</Link>
      </div>
    );
  }
  if (candidate.status === "failed") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Banner level="blocking" title={failedSentence(candidate.failure_reasons)} />
        <Link href={lessonHref}>{BACK(label)}</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {header}
      <p data-testid="hp5-note" className="text-small text-ink2">{HP5_NOTE}</p>
      {FROZEN.includes(lesson.state) ? <Banner level="info" title={frozenNote(label, lesson.state)} /> : null}
      {adopt.banner ? <Banner level="blocking" title={adopt.banner} /> : null}
      <CompareView
        rows={alignRows(lesson.sections, candidate.sections)}
        wide={wide}
        versionLabel={vLabel}
        canAdopt={allowed}
        adoptedBy={adopt.adoptedBy}
        busy={adopt.busy}
        onAdopt={(address, name) => void adopt.adopt("section", address, name)}
      />
    </div>
  );
}
