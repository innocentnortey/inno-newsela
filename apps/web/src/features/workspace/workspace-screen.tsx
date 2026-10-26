"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageSheet } from "@/components/layout";
import { StatusPill } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import type { PresenceEntry } from "@/editor/presence";
import { LessonEditor, type EditorClientState, type LessonEditorHandle } from "@/editor/lesson-editor";
import type { AssistSelection } from "@/features/assist/assist-panel";
import { assistEnabled } from "@/features/assist/cut";
import { WorkspaceActionBar } from "@/features/workspace/actions/action-bar";
import { IssueActions } from "@/features/workspace/actions/standards/issue-actions";
import { StandardDecisionButtons } from "@/features/workspace/actions/standard-decision";
import { WorkspaceActionsProvider } from "@/features/workspace/actions/toast-host";
import { useReviewHeartbeat } from "@/features/workspace/actions/use-review-heartbeat";
import { heartbeatArgs } from "@/features/workspace/actions/heartbeat-args";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { useSession } from "@/features/frame/session-context";
import { lessonIdFromKey } from "@/lib/keys";
import type { components } from "@/lib/api-types";
import { AssistHost } from "./assist-host";
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

/** One toast stack for the whole page, so an Undo toast outlives the standard row that raised it. */
export function WorkspaceScreen(props: { unitKey: string; lessonKey: string }) {
  return (
    <WorkspaceActionsProvider>
      <WorkspaceBody {...props} />
    </WorkspaceActionsProvider>
  );
}

function WorkspaceBody({ unitKey, lessonKey }: { unitKey: string; lessonKey: string }) {
  const { role, user } = useSession();
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
  // The version id comes from CON-11 (CHG-7); a lesson without one sends no heartbeat. No id is invented.
  useReviewHeartbeat(heartbeatArgs(lesson));
  const reread = useCallback(() => {
    retry();
    issuesPoll.retry();
  }, [retry, issuesPoll]);
  const readOnly = lesson ? isReadOnly(role, lesson.state) : true;
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  // NL-116: the AI assist panel replaces the evidence rail while open; the selection is read when it opens.
  const editorRef = useRef<LessonEditorHandle>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistSelection, setAssistSelection] = useState<AssistSelection | null>(null);
  const [, setAssistPending] = useState(false);
  const openAssist = useCallback(() => {
    setAssistSelection(editorRef.current?.getSelection() ?? null);
    setAssistOpen(true);
  }, []);
  const [clientState, setClientState] = useState<EditorClientState>("connecting");
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
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
        <SchemaUnknownView lessonLabel={label} schemaVersion={load.schemaVersion} unknownNodes={load.unknownNodes} boardHref={boardHref} />
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
  const canAssist = assistEnabled() && !readOnly;
  const rail =
    assistOpen && canAssist ? (
      <AssistHost
        lessonId={lesson.lesson_id}
        selection={assistSelection}
        onClose={() => setAssistOpen(false)}
        onPendingChange={setAssistPending}
        onLessonChanged={reread}
      />
    ) : (
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
        renderIssueActions={issues ? (issue) => <IssueActions issue={issue} lesson={lesson} issues={issues} onChanged={reread} /> : undefined}
        renderStandardActions={(s) => (
          <StandardDecisionButtons lessonId={lesson.lesson_id} code={s.code} origin={s.origin} confirmation={s.confirmation ?? null} onChanged={reread} />
        )}
      />
    );
  // Look sheet M3 (SCR-9): the stepper centred above; outline · page sheet · evidence rail; the footer action bar under
  // the outline and the page, with the rail running beside both. Below xl the outline sits above the page; on phones
  // everything stacks and the rail comes last.
  const outline = <OutlineColumn sections={lesson.sections} issues={issues?.issues ?? []} textRootRef={textRef} />;
  return (
    <div
      data-layout="workspace"
      className="grid grid-cols-1 gap-x-[18px] gap-y-3 lg:grid-cols-[minmax(0,1fr)_var(--layout-rail)]"
    >
      <div className="flex justify-center lg:col-span-2">
        <Stepper current={stepFor(lesson.state)} offPath={off ? <StatusPill status={off} /> : undefined} />
      </div>
      {/* Outline, page and footer share one grid, so the sticky footer has the whole document to travel along
          (a sticky item alone in its own grid row cannot move). */}
      <div className="grid min-w-0 grid-cols-1 gap-x-[18px] gap-y-3 self-start xl:grid-cols-[var(--layout-outline)_minmax(0,1fr)]">
        <div className="hidden min-w-0 xl:sticky xl:top-[calc(var(--layout-top-bar)+16px)] xl:block xl:self-start">{outline}</div>
        {/* design.md: below xl the outline becomes a "Sections" menu above the page. */}
        <details className="bg-panel border-hair rounded-lg border px-3 py-2 xl:hidden">
          <summary className="text-small text-ink2 cursor-pointer font-semibold">{`Sections · ${totalMinutes(lesson.sections)} min`}</summary>
          <div className="pt-2">{outline}</div>
        </details>
        <div className="min-w-0">
          <PageSheet toolbar={readOnly ? undefined : <div ref={setToolbarHost} />}>
            <StateBanners lesson={lesson} role={role} issues={issues} />
            <h1 className="text-page text-ink">{lesson.title}</h1>
            <p className="text-small text-ink2 mt-2 mb-5 flex flex-wrap items-center gap-2">
              <span>{lesson.type}</span>
              <span aria-hidden="true" className="bg-edge size-[3px] rounded-full" />
              <span>{`${totalMinutes(lesson.sections)} min`}</span>
              <span aria-hidden="true" className="bg-edge size-[3px] rounded-full" />
              <StatusPill status={`lesson.${lesson.state}`} />
              <span className="bg-well text-ink2 font-code rounded-xs px-1.5 py-0.5 text-[11.5px] font-semibold">{`v${lesson.version_number}`}</span>
            </p>
            {readOnly ? (
              <LessonText ref={textRef} lesson={lesson} />
            ) : (
              // S-17: the live editor replaces the read view for a reviewer on an editable lesson. Its section wrappers carry
              // data-address and id="sec-<address>" like LessonText, so outline and issue jumps work; they focus the section.
              <div ref={textRef} data-testid="editor-region" data-others-present={presence.length}>
                <LessonEditor
                  ref={editorRef}
                  lessonId={lesson.lesson_id}
                  lesson={lesson}
                  readOnly={false}
                  viewer={{ user_id: user.user_id, name: user.name, role }}
                  onPresence={setPresence}
                  onClientState={(r) => setClientState(r.state)}
                  toolbarHost={toolbarHost}
                />
              </div>
            )}
          </PageSheet>
        </div>
        {issues ? (
          <div className="sticky bottom-3 z-[var(--z-sticky)] min-w-0 xl:col-span-2">
            <WorkspaceActionBar lesson={lesson} issues={issues} clientState={shownClientState} onLessonChanged={reread} onOpenAssist={canAssist ? openAssist : undefined} />
          </div>
        ) : null}
      </div>
      {/* Inner padding keeps the cards' focus rings inside the scrolling rail. */}
      <div className="min-w-0 lg:sticky lg:top-[calc(var(--layout-top-bar)+16px)] lg:max-h-[calc(100dvh-var(--layout-top-bar)-32px)] lg:self-start lg:overflow-y-auto lg:rounded-xl lg:p-0.5">
        {rail}
      </div>
    </div>
  );
}
