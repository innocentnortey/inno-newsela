"use client";
import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import { usePoll } from "@/lib/use-poll";
import type { Candidate } from "./derive";

export function useCandidate(lessonId: string | null, candidateId: string) {
  // Epoch ms of the last reload() request; polling is on until a result newer than it arrives.
  const [reloadAt, setReloadAt] = useState(0);
  const [data, setData] = useState<Candidate | undefined>(undefined);
  const [at, setAt] = useState(0);
  const terminal = data?.status === "ready" || data?.status === "failed";
  const enabled = lessonId !== null && (!terminal || at < reloadAt);
  const poll = usePoll(
    () =>
      api
        .GET("/lessons/{lessonId}/candidates/{candidateId}", { params: { path: { lessonId: lessonId as string, candidateId } } })
        .then((r) => r.data as Candidate),
    { intervalMs: 2000, enabled },
  );
  // Mirror the poll result into state during render (the documented derive-from-props pattern).
  const stamp = poll.dataAt?.getTime() ?? 0;
  if (poll.data && stamp !== at) {
    setData(poll.data);
    setAt(stamp);
  }
  const reload = useCallback(() => setReloadAt(Date.now()), []);
  return { candidate: data, error: poll.error, reload };
}
