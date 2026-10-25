"use client";
// Dev-only host for the SCR-9 actions: ?lesson=G6.U4.L4&client=stored|saving|DISCONNECTED|synced.
// A stub rail stands in for the evidence rail until the full page wires the real editor state (NL-63).
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import { SessionGate } from "@/features/frame/session-gate";
import { WorkspaceActionBar } from "@/features/workspace/actions/action-bar";
import { StandardDecisionButtons } from "@/features/workspace/actions/standard-decision";
import { WorkspaceActionsProvider } from "@/features/workspace/actions/toast-host";
import { useReviewHeartbeat } from "@/features/workspace/actions/use-review-heartbeat";
import type { EditorClientState } from "@/editor/lesson-editor";
import { api } from "@/lib/api-client";
import { AnnounceProvider } from "@/lib/announce";
import type { components } from "@/lib/api-types";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];
const STEP: Record<Lesson["state"], 1 | 2 | 3 | 4 | 5> = {
  generation_failed: 1, draft: 2, in_review: 2, changes_requested: 2, reopened: 2, submitted: 3, approved: 4, exported: 5,
};
const CLIENT: EditorClientState[] = ["stored", "saving", "DISCONNECTED", "synced"];

function Screen() {
  const params = useSearchParams();
  const lessonId = params.get("lesson") ?? "G6.U4.L4";
  const asked = params.get("client") as EditorClientState | null;
  const clientState: EditorClientState = asked && CLIENT.includes(asked) ? asked : "stored";
  const [data, setData] = useState<{ lesson: Lesson; issues: IssueList } | null>(null);

  const reload = useCallback(() => {
    Promise.all([
      api.GET("/lessons/{lessonId}", { params: { path: { lessonId } } }),
      api.GET("/lessons/{lessonId}/issues", { params: { path: { lessonId } } }),
    ])
      .then(([l, i]) => setData({ lesson: l.data as Lesson, issues: i.data as IssueList }))
      .catch(() => {});
  }, [lessonId]);
  useEffect(() => reload(), [reload]);
  useReviewHeartbeat({ lessonId, versionId: `lv-${data?.lesson.version_number ?? 0}` });

  if (!data) return <p className="text-ink2 p-6">Loading…</p>;
  const { lesson, issues } = data;
  return (
    <main className="bg-canvas flex min-h-screen flex-col gap-4 p-6">
      <Stepper current={STEP[lesson.state]} />
      <p className="text-small text-ink2">
        State: <span data-testid="lesson-state">{lesson.state}</span>
      </p>
      <aside aria-label="Evidence" className="flex flex-col gap-3">
        {issues.issues
          .filter((i) => !i.resolution)
          .map((i) => (
            <button key={i.issue_id} type="button" data-issue-card className="border-hair bg-panel rounded-lg border p-3 text-left">
              {i.message}
            </button>
          ))}
        {lesson.front_matter.standards.map((s) => (
          <div key={s.code} className="flex items-center gap-2">
            <span className="text-small">{s.code}</span>
            <StandardDecisionButtons lessonId={lesson.lesson_id} code={s.code} origin={s.origin} confirmation={s.confirmation ?? null} onChanged={reload} />
          </div>
        ))}
      </aside>
      <WorkspaceActionBar lesson={lesson} issues={issues} clientState={clientState} onLessonChanged={reload} />
    </main>
  );
}

export function Harness() {
  return (
    <AnnounceProvider>
      <SessionGate>
        <WorkspaceActionsProvider>
          <Screen />
        </WorkspaceActionsProvider>
      </SessionGate>
    </AnnounceProvider>
  );
}
