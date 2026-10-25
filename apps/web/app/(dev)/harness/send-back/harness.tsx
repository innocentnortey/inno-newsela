"use client";
// Dev-only host for SCR-15: ?lesson=G6.U4.L5. Openers show only for roles that may use them.
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { SessionGate } from "@/features/frame/session-gate";
import { useSession } from "@/features/frame/session-context";
import { SendBackDialog } from "@/features/send-back/send-back-dialog";
import { AnnounceProvider } from "@/lib/announce";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { can } from "@/lib/roles";

type Lesson = components["schemas"]["Lesson"];

function Screen() {
  const params = useSearchParams();
  const lessonId = params.get("lesson") ?? "G6.U4.L5";
  const { role } = useSession();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [open, setOpen] = useState<"request_changes" | "reopen" | null>(null);
  const [stale, setStale] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const openFrom = (mode: "request_changes" | "reopen") => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(mode);
  };

  const reload = useCallback(() => {
    api
      .GET("/lessons/{lessonId}", { params: { path: { lessonId } } })
      .then((r) => setLesson(r.data as Lesson))
      .catch(() => {});
  }, [lessonId]);
  useEffect(() => reload(), [reload]);

  if (!lesson) return <p className="text-ink2 p-6">Loading…</p>;
  return (
    <main className="bg-canvas flex min-h-screen flex-col gap-4 p-6">
      <h1 className="text-page text-ink">Send back harness (dev only)</h1>
      <p className="text-small text-ink2">
        State: <span data-testid="lesson-state">{lesson.state}</span>
      </p>
      {stale ? (
        <Banner
          level="blocking"
          title="This lesson changed since you opened it. Reload."
          action={
            <Button variant="secondary" size="sm" onClick={() => { setStale(false); reload(); }}>
              Reload
            </Button>
          }
        />
      ) : null}
      <div className="flex gap-2">
        {can(role, "request_changes") ? (
          <Button variant="secondary" onClick={() => openFrom("request_changes")}>Request changes…</Button>
        ) : null}
        {can(role, "reopen_lesson") ? (
          <Button variant="secondary" onClick={() => openFrom("reopen")}>Reopen…</Button>
        ) : null}
      </div>
      {lesson.snapshot ? (
        <SendBackDialog
          lessonId={lessonId}
          mode={open ?? "request_changes"}
          pin={{ snapshotHash: lesson.snapshot.content_hash, snapshotStateVector: lesson.snapshot.state_vector }}
          open={open !== null}
          onClose={() => { setOpen(null); reload(); setTimeout(() => opener.current?.focus(), 0); }}
          onStale={() => setStale(true)}
        />
      ) : null}
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
