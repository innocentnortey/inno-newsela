"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioGroup } from "@/components/ui/choice";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Link } from "@/components/ui/link";
import { TextInput } from "@/components/ui/text-input";
import { ApiError, api, isApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { unitKeyFromId } from "@/lib/keys";
import { parseRows } from "./parse-rows";
import { formatPromptLine } from "./prompt-line";
import { useNavigate } from "./use-navigate";

type PromptVersions = components["schemas"]["PromptVersions"];
type ValidationReport = components["schemas"]["ValidationReport"];
type StartRunRequest = components["schemas"]["StartRunRequest"];

interface FieldErrors {
  rows?: string;
  cap?: string;
}

export interface StartRunFormProps {
  outlineVersionId: string;
  onClose: () => void;
}

export function StartRunForm({ outlineVersionId, onClose }: StartRunFormProps) {
  const navigate = useNavigate();
  const [scope, setScope] = useState<"all" | "rows">("rows");
  const [rowsText, setRowsText] = useState("8, 9, 25");
  const [capText, setCapText] = useState("13.00");
  const [prompt, setPrompt] = useState<PromptVersions | null>(null);
  const [promptState, setPromptState] = useState<"loading" | "ready" | "failed">("loading");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<string>(crypto.randomUUID());
  const alive = useRef(true);
  // Captured during the first render, before Radix moves focus into the dialog.
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));

  const [attempt, setAttempt] = useState(0);
  const retryPrompt = () => {
    setPromptState("loading");
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await api.GET("/prompt-versions");
        if (!live) return;
        if (data) {
          setPrompt(data);
          setPromptState("ready");
        } else setPromptState("failed");
      } catch {
        if (live) setPromptState("failed");
      }
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const { data } = await api.GET("/outline-versions/{outlineVersionId}/report", {
          params: { path: { outlineVersionId } },
        });
        if (alive.current && data) setReport(data);
      } catch {
        // The server checks the rows when the report is missing.
      }
    })();
    // Radix focuses the header Close first; this runs after it.
    const t = setTimeout(() => bodyRef.current?.querySelector<HTMLInputElement>("input[name=scope]:checked")?.focus(), 0);
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, [outlineVersionId]);

  // The dialog has no Radix trigger, so give focus back to whatever opened it.
  useEffect(
    () => () => {
      setTimeout(() => {
        if (!document.querySelector("[role=dialog]") && opener instanceof HTMLElement) opener.focus();
      }, 0);
    },
    [opener],
  );

  useEffect(() => {
    if (serverError) errRef.current?.focus();
  }, [serverError]);

  const changed = () => {
    keyRef.current = crypto.randomUUID();
  };

  function errorBanner(e: ApiError): ReactNode {
    let title: string;
    let action: ReactNode = null;
    switch (e.code) {
      case "ROLE_FORBIDDEN":
        title = "Only authors can start a run.";
        break;
      case "DAY_CAP_REACHED":
        {
          const left = e.details.remaining_usd;
          title =
            typeof left === "number" && Number.isFinite(left)
              ? `Daily spend cap reached. $${left.toFixed(2)} left today. No run can start until tomorrow.`
              : "Daily spend cap reached. No run can start until tomorrow.";
        }
        break;
      case "VALIDATION_INCOMPLETE": {
        const d = e.details.errors_unconfirmed;
        const n = typeof d === "number" ? d : report?.counts.errors_unconfirmed;
        title = n === undefined ? "Confirm the report first." : `Confirm the report first: ${n} ${n === 1 ? "error" : "errors"} still to confirm.`;
        action = (
          <Link
            href="#unconfirmed-error"
            onClick={(ev) => {
              ev.preventDefault();
              onClose();
              setTimeout(() => document.querySelector<HTMLElement>("[data-unconfirmed-error]")?.focus(), 0);
            }}
          >
            Show me the error
          </Link>
        );
        break;
      }
      case "INVALID_REQUEST":
        title = "Some of these choices aren't valid. Check the rows and the cap, then try again.";
        break;
      default:
        title = e.message;
    }
    return <Banner level="blocking" title={title} action={action} />;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting || promptState !== "ready" || !prompt) return;
    setServerError(null);
    const errors: FieldErrors = {};
    const cap = Number(capText);
    if (capText.trim() === "" || !Number.isFinite(cap) || cap <= 0) errors.cap = "Set a cap above $0";
    let rows: number[] = [];
    if (scope === "rows") {
      const validSet = report
        ? new Set(report.rows.filter((r) => r.kind === "lesson" || r.kind === "flex_day").map((r) => r.row_number))
        : null;
      const parsed = parseRows(rowsText, validSet);
      if (parsed.ok) rows = parsed.rows;
      else errors.rows = parsed.message;
    }
    setFieldErrors(errors);
    if (errors.rows || errors.cap) {
      document.getElementById(errors.rows ? "start-run-rows" : "start-run-cap")?.focus();
      return;
    }
    const body: StartRunRequest = {
      outline_version_id: outlineVersionId,
      mode: "run",
      scope: scope === "all" ? { kind: "all" } : { kind: "rows", rows },
      prompt_version_id: prompt.current_prompt_version_id,
      cap_usd: cap,
    };
    const m = /^(G\d{1,2}\.U\d{1,2})\.ov\d+$/.exec(outlineVersionId);
    const unitKey = m?.[1] ? unitKeyFromId(m[1]) : null;
    setSubmitting(true);
    try {
      const { data: run } = await api.POST("/runs", { params: { header: { "Idempotency-Key": keyRef.current } }, body });
      onClose();
      navigate(unitKey && run ? `/units/${unitKey}/runs/${run.run_id}` : "/units");
    } catch (e) {
      setServerError(
        isApiError(e) ? e : new ApiError({ status: 0, code: "NETWORK", message: "Couldn't reach Lesson Studio. Try again." }),
      );
    } finally {
      if (alive.current) setSubmitting(false);
    }
  }

  const allLabel = report ? `All ${report.counts.teaching_days} teaching days` : "All teaching days";

  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Start a run"
      size="md"
      busy={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="start-run-form"
            loading={submitting}
            disabled={promptState !== "ready"}
            disabledReason={promptState !== "ready" ? "The prompt version is still loading." : undefined}
          >
            Start run
          </Button>
        </>
      }
    >
      <form id="start-run-form" onSubmit={onSubmit} noValidate>
        <div ref={bodyRef} className="flex flex-col gap-5">
          {serverError ? (
            <div ref={errRef} tabIndex={-1} className="rounded-lg outline-offset-2">
              {errorBanner(serverError)}
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <RadioGroup legend="Scope">
              <RadioCard
                name="scope"
                value="all"
                label={allLabel}
                checked={scope === "all"}
                onChange={() => {
                  changed();
                  setScope("all");
                }}
              />
              <RadioCard
                name="scope"
                value="rows"
                label="Chosen rows"
                checked={scope === "rows"}
                onChange={() => {
                  changed();
                  setScope("rows");
                }}
              />
            </RadioGroup>
            <TextInput
              id="start-run-rows"
              label="Rows"
              help="Row numbers from the outline, separated by commas"
              value={rowsText}
              disabled={scope === "all"}
              error={fieldErrors.rows}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => {
                changed();
                setRowsText(e.target.value);
              }}
            />
          </div>
          <div aria-busy={promptState === "loading"} className="flex flex-col gap-1">
            <p className="text-small text-ink font-semibold">Prompt version</p>
            {promptState === "loading" ? (
              <>
                <div data-testid="prompt-skeleton" aria-hidden className="bg-well h-5 w-72 animate-pulse rounded-md" />
                <span className="sr-only">Loading the prompt version</span>
              </>
            ) : null}
            {promptState === "ready" && prompt ? (
              <p className="text-body text-ink flex flex-wrap items-center gap-x-3">
                <span>{formatPromptLine(prompt)}</span>
                <Link href="/prompt-guidance">View prompt</Link>
              </p>
            ) : null}
            {promptState === "failed" ? (
              <p className="text-body text-ink flex items-center gap-2">
                <span>Couldn&apos;t load the prompt version.</span>
                <Button variant="ghost" size="sm" onClick={() => retryPrompt()}>
                  Retry
                </Button>
              </p>
            ) : null}
          </div>
          <TextInput
            id="start-run-cap"
            label="Spend cap (dollars)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            help="The run stops before any call that would pass this cap."
            value={capText}
            error={fieldErrors.cap}
            onChange={(e) => {
              changed();
              setCapText(e.target.value);
            }}
          />
        </div>
      </form>
    </DialogShell>
  );
}
