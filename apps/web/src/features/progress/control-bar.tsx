"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleNote } from "@/features/frame/conventions";
import { api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import {
  availableControls,
  controlErrorText,
  type ControlAction,
} from "./run-copy";

export type ControlError =
  { kind: "forbidden"; message: string } | { kind: "failed"; text: string };

const LABELS: Record<ControlAction, string> = {
  cancel: "Cancel run",
  retry_failed: "Retry failed",
  resume: "Resume",
};

export interface ControlBarProps {
  runId: string;
  state: components["schemas"]["RunState"];
  role: Role;
  onChanged: () => void;
  onError: (err: ControlError | null) => void;
}

export function ControlBar({
  runId,
  state,
  role,
  onChanged,
  onError,
}: ControlBarProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<ControlAction | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  if (role !== "author")
    return <RoleNote>Only authors can control a run</RoleNote>;
  const actions = availableControls(state);
  if (actions.length === 0) return null;

  const perform = async (action: ControlAction) => {
    if (busy) return;
    setBusy(action);
    try {
      await api.POST("/runs/{runId}/actions", {
        params: { path: { runId } },
        body: { action },
      });
      onError(null);
      setConfirming(false);
      onChanged();
    } catch (e) {
      if (isApiError(e) && e.code === "ROLE_FORBIDDEN")
        onError({ kind: "forbidden", message: e.message });
      else onError({ kind: "failed", text: controlErrorText(action) });
      if (isApiError(e) && e.code === "INVALID_TRANSITION") onChanged();
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  const click = (action: ControlAction) => {
    if (action === "cancel") setConfirming(true);
    else void perform(action);
  };

  if (confirming) {
    return (
      <div
        role="group"
        aria-label="Confirm cancel"
        className="flex flex-col items-start gap-2"
      >
        <p className="text-body text-ink">
          Cancel the run? Calls in flight will finish; no new calls start.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            loading={busy === "cancel"}
            onClick={() => void perform("cancel")}
          >
            Cancel run
          </Button>
          <Button
            ref={keepRef}
            variant="secondary"
            onClick={() => setConfirming(false)}
          >
            Keep running
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a}
          variant={a === "cancel" ? "danger" : "primary"}
          loading={busy === a}
          onClick={() => click(a)}
        >
          {LABELS[a]}
        </Button>
      ))}
    </div>
  );
}
