"use client";
// Dev-only host for SCR-11: ?lesson=G6.U4.L31&mode=resolve|clear_flag&target=iss-31-1 (dialog starts open unless &open=0).
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SessionGate } from "@/features/frame/session-gate";
import { ResolveDialog } from "@/features/resolve/resolve-dialog";
import { WorkspaceActionsProvider } from "@/features/workspace/actions/toast-host";
import { AnnounceProvider } from "@/lib/announce";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];

function Screen() {
  const params = useSearchParams();
  const lessonId = params.get("lesson") ?? "G6.U4.L31";
  const mode = params.get("mode") === "resolve" ? "resolve" : "clear_flag";
  const target = params.get("target") ?? "iss-31-1";
  const [open, setOpen] = useState(params.get("open") !== "0");
  const [openFor, setOpenFor] = useState<{ id: string; mode: "resolve" | "clear_flag" }>({ id: target, mode });
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

  if (!data) return <p className="text-ink2 p-6">Loading…</p>;
  const pending = data.issues.issues.filter((i) => !i.resolution);
  const done = data.issues.issues.filter((i) => i.resolution);
  return (
    <main className="bg-canvas flex min-h-screen flex-col gap-4 p-6">
      <p className="text-small text-ink2">
        State: <span data-testid="lesson-state">{data.lesson.state}</span>
      </p>
      <ul className="flex flex-col gap-3">
        {pending.map((i) => {
          const m = i.kind === "safety_flag_open" ? "clear_flag" : "resolve";
          return (
            <li key={i.issue_id} data-issue-id={i.issue_id} className="flex items-center gap-2">
              <button type="button" data-issue-card className="border-hair bg-panel rounded-lg border p-3 text-left">
                {i.message}
              </button>
              <button
                type="button"
                className="border-hair text-small rounded-md border px-2 py-1"
                onClick={() => {
                  setOpenFor({ id: i.issue_id, mode: m });
                  setOpen(true);
                }}
              >
                {m === "clear_flag" ? "Clear flag…" : "Resolve…"}
              </button>
            </li>
          );
        })}
      </ul>
      {done.length > 0 ? (
        <section aria-labelledby="resolved-h">
          <h2 id="resolved-h" className="text-title text-ink">Resolved</h2>
          <ul>
            {done.map((i) => (
              <li key={i.issue_id} data-issue-id={i.issue_id} className="text-small text-ink2">
                <button type="button" data-issue-card className="text-left">{i.message}</button> · {i.resolution?.by}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ResolveDialog
        lessonId={lessonId}
        mode={openFor.mode}
        issueId={openFor.mode === "resolve" ? openFor.id : undefined}
        flagId={openFor.mode === "clear_flag" ? openFor.id : undefined}
        open={open}
        onClose={() => setOpen(false)}
        onResolved={reload}
      />
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
