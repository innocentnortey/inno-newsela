import type { components } from "@/lib/api-types";
import { KIND_LABEL } from "./copy";

export type LessonHistory = components["schemas"]["LessonHistory"];
export type VersionEntry = components["schemas"]["VersionEntry"];
export type AuditRow = components["schemas"]["AuditRow"];

export function shortHash(h: string): string {
  return `${h.slice(0, 4)}…${h.slice(-4)}`;
}

export function formatWhen(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function kindLabel(v: VersionEntry): string {
  const base = KIND_LABEL[v.kind];
  if (v.kind !== "candidate") return base;
  return v.adopted === true ? `${base} (adopted)` : `${base} (not adopted)`;
}

export function selectedVersion(
  versions: VersionEntry[],
  param: string | null,
): VersionEntry | null {
  if (versions.length === 0) return null;
  const n =
    param !== null && /^\d+$/.test(param) ? Number.parseInt(param, 10) : NaN;
  const match = versions.find((v) => v.version_number === n);
  if (match) return match;
  return versions.reduce((a, b) =>
    b.version_number > a.version_number ? b : a,
  );
}

export function auditFor(audit: AuditRow[], version: VersionEntry): AuditRow[] {
  return audit.filter((r) => r.version_hash === version.content_hash);
}

const KIND_ACTION: Partial<Record<VersionEntry["kind"], string>> = {
  submit: "submit",
  approval: "approve",
  reopen: "reopen",
};
// The real audit view names every state change "lesson.transition" and carries the state in to_state (NL-100 found it).
const KIND_TO_STATE: Partial<Record<VersionEntry["kind"], string>> = {
  submit: "submitted",
  approval: "approved",
  reopen: "reopened",
};

export function transitionFor(
  audit: AuditRow[],
  version: VersionEntry,
): {
  from_state: AuditRow["from_state"];
  to_state: AuditRow["to_state"];
  reason: AuditRow["reason"];
} | null {
  const action = KIND_ACTION[version.kind];
  if (!action) return null;
  const row = auditFor(audit, version).find(
    (r) => r.action === action || (r.action === "lesson.transition" && r.to_state === KIND_TO_STATE[version.kind]),
  );
  return row
    ? { from_state: row.from_state, to_state: row.to_state, reason: row.reason }
    : null;
}

const ACTION_LABEL: Record<string, string> = {
  start_review: "Review started",
  submit: "Submitted",
  withdraw: "Withdrawn",
  approve: "Approved",
  request_changes: "Changes requested",
  reopen: "Reopened",
  clear_safety_flag: "Safety flag cleared",
};

export function actionLabel(action: string): string {
  const known = ACTION_LABEL[action];
  if (known) return known;
  const words = action.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditLine(row: AuditRow): string {
  return `${actionLabel(row.action)} by ${row.user}${row.reason ? `: ${row.reason}` : ""} · ${formatClock(row.at)}`;
}

export function stateWord(s: string | null): string {
  return s ? s.replace(/_/g, " ") : "none";
}

export interface ProvenanceRow {
  key: string;
  label: string;
  value: string | null;
  state: "present" | "missing" | "na";
}

const HUMAN_KINDS: VersionEntry["kind"][] = ["submit", "approval", "reopen"];

export function provenanceRows(v: VersionEntry): ProvenanceRow[] {
  const p = v.provenance as Partial<VersionEntry["provenance"]>;
  const empty = (x: unknown) => x === undefined || x === null || x === "";
  const row = (
    key: string,
    label: string,
    raw: unknown,
    format: (x: never) => string,
    na = false,
  ): ProvenanceRow => {
    if (empty(raw))
      return na
        ? { key, label, value: null, state: "na" }
        : { key, label, value: null, state: "missing" };
    return { key, label, value: format(raw as never), state: "present" };
  };
  const human = HUMAN_KINDS.includes(v.kind);
  const str = (x: string) => String(x);
  return [
    row("outline_row_hash", "Outline-row hash", p.outline_row_hash, str),
    row("prompt_version_id", "Prompt version", p.prompt_version_id, str),
    row("model", "Model", p.model, str, human),
    row("schema_version", "Schema version", p.schema_version, (x: number) =>
      String(x),
    ),
    row(
      "example_set_id",
      "Example set",
      p.example_set_id,
      str,
      human || v.kind === "candidate",
    ),
    row("run_id", "Run", p.run_id, str),
    row("cost_usd", "Cost", p.cost_usd, (x: number) => `$${x.toFixed(2)}`),
  ];
}

export function lessonNumber(lessonId: string): string {
  const last = lessonId.split(".").pop() ?? lessonId;
  return /^L\d+$/.test(last)
    ? last.slice(1)
    : /^F\d+$/.test(last)
      ? `Flex ${last.slice(1)}`
      : lessonId;
}

export function unitLabelFromKey(unitKey: string): string {
  const m = /^g(\d+)-u(\d+)$/.exec(unitKey);
  return m ? `Unit ${m[2]}` : unitKey;
}
