import type { ReactNode } from "react";
import { CodeChip } from "@/components/ui/badge";
import { STATUS_SPECS } from "@/components/ui/status";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import type { components } from "@/lib/api-types";
import { issueStatusKey, kindLabel, kindSentence } from "./issue-labels";

type Issue = components["schemas"]["Issue"];

export interface IssueCardProps {
  issue: Issue;
  number: number;
  sectionLabel: string | null;
  selected: boolean;
  stale: boolean;
  onGo: (issue: Issue) => void;
  /** SLOT NL-65 / NL-66: Resolve and Clear flag buttons render here, outside the card button. */
  actions?: ReactNode;
}

export function IssueCard({ issue, number, sectionLabel, selected, stale, onGo, actions }: IssueCardProps) {
  if (issue.resolution) {
    return (
      <li className="bg-well flex flex-col gap-1 rounded-lg p-3" data-issue-id={issue.issue_id}>
        <StatusPill status="issue.resolved" by={issue.resolution.by} />
        <p className="text-small text-ink2">{issue.resolution.reason}</p>
      </li>
    );
  }
  // WCAG 2.5.3: the accessible name must contain the visible text, in order, after the "Go to issue N" prefix.
  const visible = [STATUS_SPECS[issueStatusKey(issue)].label, kindSentence(issue.kind), issue.address, issue.message]
    .filter(Boolean)
    .join(" ");
  const name = `Go to issue ${number}: ${kindLabel(issue.kind)}${sectionLabel ? ` in ${sectionLabel}` : ""}. ${visible}`;
  return (
    <li className="flex flex-col gap-2" data-issue-id={issue.issue_id}>
      <button
        type="button"
        data-issue-card
        data-stale={stale}
        aria-label={name}
        aria-current={selected ? "true" : undefined}
        onClick={() => onGo(issue)}
        className={cn(
          "border-hair flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left",
          selected ? "bg-selected" : "bg-panel",
          stale && "text-ink2",
        )}
      >
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill status={issueStatusKey(issue)} />
          <span className="text-label">{kindSentence(issue.kind)}</span>
          {issue.address ? <CodeChip>{issue.address}</CodeChip> : null}
        </span>
        <span className="text-small">{issue.message}</span>
      </button>
      {actions}
    </li>
  );
}
