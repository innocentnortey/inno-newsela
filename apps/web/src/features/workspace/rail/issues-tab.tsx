"use client";
import { useEffect, useRef } from "react";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { IssueCard } from "./issue-card";
import { addressLabel } from "./issue-labels";

type Issue = components["schemas"]["Issue"];
type IssueList = components["schemas"]["IssueList"];
type Section = components["schemas"]["Section"];

export function countLine(c: IssueList["counts"]): string {
  const parts = [
    c.blocking ? `${c.blocking} blocking` : null,
    c.confirmation ? `${c.confirmation} to confirm` : null,
    c.advisory ? `${c.advisory} advisory` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No issues";
}

export interface IssuesTabProps {
  issues: IssueList;
  sections: Section[];
  selectedId: string | null;
  onGo: (issue: Issue) => void;
  /** SLOT NL-65 / NL-66: per-issue Resolve / Clear flag buttons. */
  renderActions?: (issue: Issue) => React.ReactNode;
}

export function IssuesTab({ issues, sections, selectedId, onGo, renderActions }: IssuesTabProps) {
  const announce = useAnnounce();
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const previous = seen.current;
    seen.current = issues.checked_hash;
    if (!issues.pending && previous !== null && previous !== issues.checked_hash) {
      announce(`Blocking issues: ${issues.counts.blocking}`);
    }
  }, [issues.checked_hash, issues.pending, issues.counts.blocking, announce]);

  const open = issues.issues.filter((i) => !i.resolution);
  const resolved = issues.issues.filter((i) => i.resolution);
  const card = (issue: Issue, number: number) => (
    <IssueCard
      key={issue.issue_id}
      issue={issue}
      number={number}
      sectionLabel={issue.address ? addressLabel(issue.address, sections) : null}
      selected={issue.issue_id === selectedId}
      stale={issues.pending}
      onGo={onGo}
      actions={renderActions?.(issue)}
    />
  );
  return (
    <div className="flex flex-col gap-3">
      {issues.pending ? (
        <p data-testid="checking" className="text-small text-ink2">Checking…</p>
      ) : null}
      <p className="text-small text-ink2">{countLine(issues.counts)}</p>
      <ol className="flex flex-col gap-2">{open.map((issue, i) => card(issue, i + 1))}</ol>
      {resolved.length > 0 ? (
        <details>
          <summary className="text-small text-ink2 cursor-pointer font-semibold">{`Resolved (${resolved.length})`}</summary>
          <ul className="mt-2 flex flex-col gap-2">{resolved.map((issue, i) => card(issue, i + 1))}</ul>
        </details>
      ) : null}
    </div>
  );
}
