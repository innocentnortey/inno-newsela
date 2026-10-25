"use client";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Link } from "@/components/ui/link";
import { Textarea } from "@/components/ui/text-input";
import { api, isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { usePoll } from "@/lib/use-poll";
import { COLLAB_DOWN, DRAFTING, REGEN_CAP, REGEN_LOCKED } from "./copy";

type Candidate = components["schemas"]["Candidate"];

export interface RegenerateButtonProps {
  lesson: components["schemas"]["Lesson"];
  unitKey: string | null;
  lessonKey: string | null;
  variant?: "primary" | "secondary";
  onChanged: () => void;
}

function errorText(e: unknown): string {
  if (!isApiError(e)) return COLLAB_DOWN;
  if (e.code === "LESSON_LOCKED") return REGEN_LOCKED;
  if (e.code === "DAY_CAP_REACHED") return REGEN_CAP;
  if (e.code === "COLLAB_UNAVAILABLE") return COLLAB_DOWN;
  return e.message;
}

/** Polls the candidate every 2 s until it is ready or failed. */
function CandidateStatus({ lessonId, started, link, onReady }: { lessonId: string; started: Candidate; link: string | null; onReady: () => void }) {
  const announce = useAnnounce();
  const [settled, setSettled] = useState(false);
  const poll = usePoll(
    () =>
      api
        .GET("/lessons/{lessonId}/candidates/{candidateId}", { params: { path: { lessonId, candidateId: started.candidate_id } } })
        .then((r) => {
          const c = r.data as Candidate;
          if (c.status === "ready" || c.status === "failed") setSettled(true);
          return c;
        }),
    { intervalMs: 2000, enabled: !settled && started.status !== "ready" && started.status !== "failed" },
  );
  const candidate = poll.data && poll.data.candidate_id === started.candidate_id ? poll.data : started;
  const terminal = candidate.status === "ready" || candidate.status === "failed";
  const ready = candidate.status === "ready";
  const fired = useRef(false);
  useEffect(() => {
    if (!ready || fired.current) return;
    fired.current = true;
    announce("Candidate ready.");
    onReady();
  }, [ready, announce, onReady]);

  if (!terminal) {
    return (
      <p role="status" data-testid="regen-status" className="text-small text-ink2 basis-full">
        {DRAFTING}
      </p>
    );
  }
  if (ready) {
    return (
      <p role="status" data-testid="regen-status" className="text-small text-ink2 basis-full">
        {link ? <Link href={link}>Compare the candidate</Link> : "The candidate is ready."}
      </p>
    );
  }
  return (
    <p role="status" data-testid="regen-status" className="text-small text-danger basis-full">
      {`The candidate failed: ${candidate.failure_reasons.map((r) => r.check).join("; ")}. The current lesson is unchanged.`}
    </p>
  );
}

export function RegenerateButton({ lesson, unitKey, lessonKey, variant = "secondary", onChanged }: RegenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<Candidate | null>(null);
  const lessonId = lesson.lesson_id;

  async function submit() {
    setBusy(true);
    setError(null);
    const trimmed = note.trim();
    try {
      const { data } = await api.POST("/lessons/{lessonId}/candidates", {
        params: { path: { lessonId } },
        ...(trimmed ? { body: { note: trimmed } } : {}),
      });
      setStarted(data as Candidate);
      setOpen(false);
      setNote("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const link = started && unitKey && lessonKey ? `/units/${unitKey}/lessons/${lessonKey}/candidates/${started.candidate_id}` : null;

  return (
    <>
      <Button variant={variant} size="lg" onClick={() => setOpen(true)}>
        Regenerate…
      </Button>
      <DialogShell
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        busy={busy}
        size="sm"
        title="Regenerate this lesson"
        description="Optional: tell the model what to change. The current lesson stays as it is."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void submit()}>
              Regenerate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <Banner level="blocking" title={error} /> : null}
          <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </DialogShell>
      {started ? <CandidateStatus key={started.candidate_id} lessonId={lessonId} started={started} link={link} onReady={onChanged} /> : null}
    </>
  );
}
