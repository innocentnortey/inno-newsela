"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/frame/session-context";
import { api, isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { COLLAB_DOWN, UNDO_GONE } from "./copy";
import { ToastHostBoundary, useWorkspaceToast } from "./toast-host";

export interface StandardDecisionButtonsProps {
  lessonId: string;
  code: string;
  origin: "outline" | "outline-fixed" | "narrowed" | "added";
  confirmation: "open" | "confirmed" | "removed" | null;
  /** The parent re-reads the lesson and its issues. */
  onChanged: () => void;
}

export function StandardDecisionButtons(props: StandardDecisionButtonsProps) {
  const { role } = useSession();
  if (role !== "reviewer" || (props.origin !== "narrowed" && props.origin !== "added") || props.confirmation !== "open") return null;
  return (
    <ToastHostBoundary>
      <Buttons {...props} />
    </ToastHostBoundary>
  );
}

function Buttons({ lessonId, code, onChanged }: StandardDecisionButtonsProps) {
  const toast = useWorkspaceToast();
  const announce = useAnnounce();
  const [busy, setBusy] = useState<"confirm" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = { params: { path: { lessonId } } };

  async function undo(toastId: string, auditId: string) {
    toast.dismiss(toastId);
    try {
      await api.POST("/lessons/{lessonId}/standards/decision", { ...path, body: { code, decision: "undo", undo_of: auditId } });
      announce(`Restored ${code}.`);
    } catch (e) {
      toast.show({ message: isApiError(e) ? (e.code === "UNDO_EXPIRED" ? UNDO_GONE : e.message) : UNDO_GONE });
    }
    onChanged();
  }

  async function decide(decision: "confirm" | "remove") {
    setBusy(decision);
    setError(null);
    try {
      const { data } = await api.POST("/lessons/{lessonId}/standards/decision", { ...path, body: { code, decision } });
      const message = decision === "confirm" ? `Confirmed ${code}.` : `Removed ${code}.`;
      const auditId = (data as components["schemas"]["ResolveResult"]).audit_id;
      const id = toast.show({ message, action: { label: "Undo", onAction: () => void undo(id, auditId) } });
      announce(message);
      onChanged();
    } catch (e) {
      setError(isApiError(e) ? (e.code === "COLLAB_UNAVAILABLE" ? COLLAB_DOWN : e.message) : COLLAB_DOWN);
      if (isApiError(e) && e.code === "LESSON_LOCKED") onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" aria-label={`Confirm ${code}`} loading={busy === "confirm"} disabled={busy === "remove"} onClick={() => void decide("confirm")}>
          Confirm
        </Button>
        <Button variant="danger" size="sm" aria-label={`Remove ${code}`} loading={busy === "remove"} disabled={busy === "confirm"} onClick={() => void decide("remove")}>
          Remove
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Openers for the rail's issue cards. They only call back; NL-62 owns the dialogs (NL-66). */
export function IssueOpenerButtons({
  issue,
  onResolve,
  onClearFlag,
}: {
  issue: components["schemas"]["Issue"];
  onResolve: () => void;
  onClearFlag: () => void;
}) {
  const { role } = useSession();
  const open = issue.resolution === null;
  const showResolve = role === "reviewer" && issue.resolvable && open;
  const showClear = (role === "reviewer" || role === "approver") && issue.kind === "safety_flag_open" && open;
  if (!showResolve && !showClear) return null;
  return (
    <div className="flex gap-2">
      {showResolve ? (
        <Button variant="secondary" size="sm" onClick={onResolve}>
          Resolve…
        </Button>
      ) : null}
      {showClear ? (
        <Button variant="secondary" size="sm" onClick={onClearFlag}>
          Clear flag…
        </Button>
      ) : null}
    </div>
  );
}
