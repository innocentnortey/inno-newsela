"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Textarea } from "@/components/ui/text-input";
import { useSession } from "@/features/frame/session-context";
import { ToastHostBoundary, useWorkspaceToast } from "@/features/workspace/actions/toast-host";
import { useAnnounce } from "@/lib/announce";
import { ApiError, api, isApiError } from "@/lib/api-client";
import { useDraft } from "@/lib/draft-memory";
import { can } from "@/lib/roles";
import {
  CANCEL, CLEAR_BUTTON, CLEAR_FORBIDDEN, CLEAR_TITLE, CLOSE, LOGGED_LINE, NOTE_LABEL, NOT_A_FIX, REASON_HELP, REASON_LABEL,
  RESOLVE_BUTTON, RESOLVE_FORBIDDEN, RESOLVE_TITLE, clearedToast, errorSentence, resolvedToast,
} from "./copy";
import { useResolveData } from "./use-resolve-data";

export interface ResolveBodyProps {
  lessonId: string;
  mode: "resolve" | "clear_flag";
  issueId?: string;
  flagId?: string;
  onClose: () => void;
  onResolved?: () => void;
}

export function ResolveBody(props: ResolveBodyProps) {
  return (
    <ToastHostBoundary>
      <Inner {...props} />
    </ToastHostBoundary>
  );
}

function Inner({ lessonId, mode, issueId, flagId, onClose, onResolved }: ResolveBodyProps) {
  const { role } = useSession();
  const toast = useWorkspaceToast();
  const announce = useAnnounce();
  const targetId = (mode === "resolve" ? issueId : flagId) ?? "";
  const allowed = can(role, mode === "resolve" ? "resolve_issue" : "clear_safety_flag");
  const { issueMessage, tip } = useResolveData(lessonId, targetId, mode, allowed);
  const [value, setValue, clearDraft] = useDraft(`resolve:${mode}:${targetId}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const cancel = () => {
    clearDraft();
    onClose();
  };

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "resolve"
          ? await api.POST("/lessons/{lessonId}/issues/{issueId}/resolution", { params: { path: { lessonId, issueId: targetId } }, body: { reason: value } })
          : await api.POST("/lessons/{lessonId}/safety-flags/{flagId}/clear", { params: { path: { lessonId, flagId: targetId } }, body: { note: value } });
      const message = mode === "resolve" ? resolvedToast(res.data!.by) : clearedToast;
      clearDraft();
      toast.show({ message });
      announce(message);
      onResolved?.();
      onClose();
      setTimeout(() => document.querySelector<HTMLElement>(`[data-issue-id="${CSS.escape(targetId)}"] [data-issue-card]`)?.focus(), 50);
    } catch (e) {
      const err = isApiError(e) ? e : new ApiError({ status: 0, code: "NETWORK", message: "network" });
      setError(err);
      setBusy(false);
      if (err.code !== "ROLE_FORBIDDEN" && err.code !== "LESSON_LOCKED") setTimeout(() => ref.current?.focus(), 0);
    }
  }

  const fieldError = error && (error.code === "REASON_REQUIRED" || error.code === "NOTE_REQUIRED") ? errorSentence(mode, error) : undefined;
  const otherError = error && !fieldError ? errorSentence(mode, error) : null;
  const title = mode === "resolve" ? RESOLVE_TITLE : CLEAR_TITLE;

  if (!allowed) {
    return (
      <DialogShell open onOpenChange={(o) => !o && cancel()} size="sm" title={title}
        footer={<Button variant="secondary" onClick={cancel}>{CLOSE}</Button>}>
        <p role="alert" className="text-small text-danger">{mode === "resolve" ? RESOLVE_FORBIDDEN : CLEAR_FORBIDDEN}</p>
      </DialogShell>
    );
  }

  return (
    <DialogShell open onOpenChange={(o) => !o && cancel()} size="sm" title={title} busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={cancel} disabled={busy}>{CANCEL}</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>{mode === "resolve" ? RESOLVE_BUTTON : CLEAR_BUTTON}</Button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <div className="bg-well rounded-lg p-3 text-body text-ink">
          {mode === "resolve" ? (issueMessage ?? "This issue") : (issueMessage ?? "Safety flag open")}
          {mode === "clear_flag" && tip ? <blockquote className="border-hair text-ink2 mt-2 border-l-2 pl-3">{tip}</blockquote> : null}
        </div>
        <Textarea
          ref={ref}
          label={mode === "resolve" ? REASON_LABEL : NOTE_LABEL}
          help={mode === "resolve" ? REASON_HELP : undefined}
          error={fieldError}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-small text-ink2">{mode === "resolve" ? NOT_A_FIX : LOGGED_LINE}</p>
        {otherError ? <p role="alert" className="text-small text-danger">{otherError}</p> : null}
      </div>
    </DialogShell>
  );
}

