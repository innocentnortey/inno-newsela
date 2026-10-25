"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceToast } from "@/features/workspace/actions/toast-host";
import { api, isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import { ADOPT_FALLBACK, adoptedToast, wholeToast } from "./copy";
import { errorSentence } from "./derive";
import { writeHandoff } from "./handoff-toast";

export const HANDOFF_DELAY_MS = 1500;

export interface UseAdoptArgs {
  lessonId: string;
  candidateId: string;
  version: number;
  unitKey: string;
  lessonKey: string;
  lessonLabel: string;
  onRefresh: () => void;
}

export function useAdopt(a: UseAdoptArgs) {
  const router = useRouter();
  const toast = useWorkspaceToast();
  const announce = useAnnounce();
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [adoptedBy, setAdoptedBy] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const adopt = useCallback(
    async (scope: "whole" | "section", address?: string, sectionName?: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      let leaving = false;
      setBusy(scope === "whole" ? "whole" : (address ?? "section"));
      setBanner(null);
      try {
        const body = scope === "whole" ? { scope } : { scope, section_address: address as string };
        const r = await api.POST("/lessons/{lessonId}/candidates/{candidateId}/adopt", {
          params: { path: { lessonId: a.lessonId, candidateId: a.candidateId } },
          body,
        });
        const result = r.data as { last_editor: string };
        if (scope === "section") {
          setAdoptedBy((m) => ({ ...m, [address as string]: result.last_editor }));
          const message = adoptedToast(sectionName ?? "Section", a.version);
          toast.show({ message });
          announce(message);
          a.onRefresh();
        } else {
          const message = wholeToast(a.version);
          toast.show({ message });
          announce(message);
          writeHandoff(message);
          leaving = true; // stay busy until the page changes: no second adopt
          timer.current = setTimeout(() => router.push(`/units/${a.unitKey}/lessons/${a.lessonKey}`), HANDOFF_DELAY_MS);
        }
      } catch (e) {
        if (isApiError(e) && e.code === "INVALID_TRANSITION") {
          a.onRefresh();
        } else {
          setBanner((isApiError(e) ? errorSentence(e.code, a.lessonLabel) : null) ?? ADOPT_FALLBACK);
        }
      } finally {
        if (!leaving) {
          busyRef.current = false;
          setBusy(null);
        }
      }
    },
    [a, router, toast, announce],
  );

  return { busy, adoptedBy, banner, adopt };
}
