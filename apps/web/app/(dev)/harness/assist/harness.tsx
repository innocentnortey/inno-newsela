"use client";
// Dev-only host for SCR-13: ?lesson=G6.U4.L4. The "Select text" button stands in for the editor selection and anchor
// that NL-63/NL-116 will supply. The Submit reasons list imitates the server's suggestion_pending issue (CON-13).
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AssistPanel, type AssistSelection } from "@/features/assist/assist-panel";
import { SessionGate } from "@/features/frame/session-gate";
import { submitReasons } from "@/features/workspace/actions/submit-reasons";
import { api } from "@/lib/api-client";
import { AnnounceProvider } from "@/lib/announce";
import type { components } from "@/lib/api-types";

type IssueList = components["schemas"]["IssueList"];
type Issue = IssueList["issues"][number];

const SELECTION: AssistSelection = {
  text: "Connection to Today's Learning",
  anchor: { start: "AQSH6qQEAgA=", end: "AQSH6qQEBgA=" },
};

function Screen() {
  const lessonId = useSearchParams().get("lesson") ?? "G6.U4.L4";
  const [issues, setIssues] = useState<IssueList>({ issues: [] } as unknown as IssueList);
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<AssistSelection | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(() => {
    api
      .GET("/lessons/{lessonId}/issues", { params: { path: { lessonId } } })
      .then((i) => i.data && setIssues(i.data))
      .catch(() => {});
  }, [lessonId]);
  useEffect(() => reload(), [reload]);

  const synthetic = { issue_id: "iss-suggestion-pending", kind: "suggestion_pending", level: "blocking", resolution: null, blocks: ["submit", "approve"], message: "An AI suggestion is waiting." } as unknown as Issue;
  const merged: IssueList = { ...issues, issues: pending ? [...issues.issues, synthetic] : issues.issues };
  const reasons = submitReasons(merged, "stored");

  return (
    <main className="bg-canvas flex min-h-screen flex-col gap-4 p-6">
      <aside aria-label="Rail" className="flex max-w-sm flex-col gap-3">
        {open ? (
          <AssistPanel lessonId={lessonId} selection={selection} onClose={() => setOpen(false)} onPendingChange={setPending} onLessonChanged={reload} />
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setSelection(SELECTION);
              setOpen(true);
            }}
          >
            Select text
          </Button>
        )}
      </aside>
      <section aria-label="Submit reasons" className="flex flex-col gap-1">
        <h2 className="text-small text-ink font-semibold">Why Submit is off</h2>
        <ul data-testid="submit-reasons" className="text-small text-ink2">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export function Harness() {
  return (
    <AnnounceProvider>
      <SessionGate>
        <Screen />
      </SessionGate>
    </AnnounceProvider>
  );
}
