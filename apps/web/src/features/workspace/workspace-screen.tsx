"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageSheet, TwoPane } from "@/components/layout";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_SPECS } from "@/components/ui/status";
import { Stepper } from "@/components/ui/stepper";
import { LessonEditor, type EditorClientState } from "@/editor/lesson-editor";
import { WorkspaceActionBar } from "@/features/workspace/actions/action-bar";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { useSession } from "@/features/frame/session-context";
import { lessonIdFromKey } from "@/lib/keys";
import type { components } from "@/lib/api-types";
import { StateBanners } from "./banners";
import { SchemaUnknownView } from "./error-views";
import { jumpToAddress, preferNodeFor } from "./jump";
import { OutlineColumn } from "./outline-column";
import { LessonText } from "./read-view/lesson-text";
import { EvidenceRail, type RailTab } from "./rail/evidence-rail";
import { tabForKind } from "./rail/issue-labels";
import { LoadingSkeleton } from "./skeleton";
import { isReadOnly, lessonLabel, offPathStatus, placeLabel, stepFor, totalMinutes } from "./state-model";
import { useIssueNav } from "./use-issue-nav";
import { useIssues, useLesson } from "./use-lesson";

type Issue = components["schemas"]["Issue"];
const TABS: RailTab[] = ["issues", "standards", "outline-row"];

export function WorkspaceScreen({ unitKey, lessonKey }: { unitKey: string; lessonKey: string }) {
  const { role } = useSession();
  const lessonId = lessonIdFromKey(unitKey, lessonKey);
  const label = lessonLabel(lessonKey);
  const boardHref = `/units/${unitKey}/board`;
  useSetBreadcrumb([{ label: "Units", href: "/units" }, { label: placeLabel(unitKey), href: boardHref }, { label }]);

  const { load, retry } = useLesson(lessonId);
  const ready = load.kind === "ready";
  const issuesPoll = useIssues(lessonId, ready);
  const issues = issuesPoll.data;

  const params = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<RailTab>(TABS.includes(initialTab as RailTab) ? (initialTab as RailTab) : "issues");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const applied = useRef(false);

  const lesson = load.kind === "ready" ? load.lesson : null;
  const readOnly = lesson ? isReadOnly(role, lesson.state) : true;
  // SLOT NL-63: onClientState receives the editor's state (NL-63 may widen it to the report object); onPresence is passed to LessonEditor too.
  const [clientState, setClientState] = useState<EditorClientState>("connecting");
  const shownClientState: EditorClientState = readOnly ? "read_only" : clientState;

  const writeUrl = useCallback((patch: { tab?: RailTab; issue?: string | null }) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("at");
    if (patch.tab) url.searchParams.set("tab", patch.tab);
    if (patch.issue !== undefined) {
      if (patch.issue) url.searchParams.set("issue", patch.issue);
      else url.searchParams.delete("issue");
    }
    window.history.replaceState(null, "", url);
  }, []);

  const goToIssue = useCallback(
    (issue: Issue) => {
      writeUrl({ issue: issue.issue_id });
      if (!issue.address || tabForKind(issue.kind) === "standards") {
        setTab("standards");
        writeUrl({ tab: "standards" });
        const std = lesson?.front_matter.standards.find((s) => issue.message.includes(s.code)) ?? lesson?.front_matter.standards[0];
        if (std) setSelectedCode(std.code);
        return;
      }
      if (textRef.current) jumpToAddress(textRef.current, issue.address, preferNodeFor(issue.kind));
    },
    [lesson, writeUrl],
  );

  const openIssues = issues ? issues.issues.filter((i) => !i.resolution) : [];
  const { selectedId, setSelectedId } = useIssueNav(openIssues, goToIssue);

  useEffect(() => {
    if (applied.current || !lesson || !issues) return;
    applied.current = true;
    const wanted = params.get("issue");
    const hit = wanted ? openIssues.find((i) => i.issue_id === wanted) : undefined;
    // Deferred so the jump runs after this render has painted the text.
    queueMicrotask(() => {
      if (hit) {
        setSelectedId(hit.issue_id);
        goToIssue(hit);
      } else if (params.get("at") && textRef.current) {
        jumpToAddress(textRef.current, params.get("at"), null);
      }
    });
  });

  if (load.kind === "loading") return <LoadingSkeleton />;
  if (load.kind === "schema_unknown") {
    return (
      <div className="p-6">
        <SchemaUnknownView lessonLabel={label} schemaVersion={load.schemaVersion} boardHref={boardHref} />
      </div>
    );
  }
  if (load.kind === "not_found") {
    return (
      <div className="p-6">
        <NotFound what={label} where={placeLabel(unitKey)} boardHref={boardHref} />
      </div>
    );
  }
  if (load.kind === "error" || !lesson) {
    return (
      <div className="p-6">
        <CantLoad thing={label} onRetry={retry} />
      </div>
    );
  }

  const off = offPathStatus(lesson.state);
  return (
    <TwoPane
      rail={
        <EvidenceRail
          lesson={lesson}
          issues={issues}
          issuesFailed={issuesPoll.error !== undefined && !issues}
          onRetryIssues={issuesPoll.retry}
          tab={tab}
          onTab={(t) => {
            setTab(t);
            writeUrl({ tab: t });
          }}
          selectedIssueId={selectedId}
          onGo={(issue) => {
            setSelectedId(issue.issue_id);
            goToIssue(issue);
          }}
          selectedCode={selectedCode}
          onSelectCode={setSelectedCode}
          // SLOT NL-65 / NL-66: renderIssueActions (Resolve, Clear flag, Insert quote dialogs mount here).
          // SLOT NL-64: renderStandardActions (Confirm, Remove, Undo).
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Stepper current={stepFor(lesson.state)} offPath={off ? <StatusPill status={off} /> : undefined} />
        <StateBanners lesson={lesson} role={role} issues={issues} />
        <div className="grid gap-6 lg:grid-cols-[var(--layout-outline)_minmax(0,1fr)]">
          <OutlineColumn sections={lesson.sections} issues={issues?.issues ?? []} textRootRef={textRef} />
          <PageSheet>
            <h1 className="text-page text-ink">{lesson.title}</h1>
            <p className="text-small text-ink2 mb-4">
              {`${lesson.type} · ${totalMinutes(lesson.sections)} min · ${STATUS_SPECS[`lesson.${lesson.state}`].label} · v${lesson.version_number}`}
            </p>
            <LessonText ref={textRef} lesson={lesson} />
            {/* SLOT NL-64: heartbeat hook mount (useReviewHeartbeat) and onLessonChanged={retry} for the action bar. */}
            {issues ? <WorkspaceActionBar lesson={lesson} issues={issues} clientState={shownClientState} /> : null}
          </PageSheet>
        </div>
        {readOnly ? null : (
          // SLOT NL-63: replace this hidden mount with the live editor (un-hide it, pass onPresence/viewer).
          <div hidden data-testid="editor-mount">
            <LessonEditor lessonId={lesson.lesson_id} lesson={lesson} readOnly={false} onClientState={setClientState} />
          </div>
        )}
      </div>
    </TwoPane>
  );
}
