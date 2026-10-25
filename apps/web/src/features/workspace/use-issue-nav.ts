"use client";
import { useEffect, useRef, useState } from "react";
import type { components } from "@/lib/api-types";

type Issue = components["schemas"]["Issue"];

/** `]` next, `[` previous (wrapping) through the open issues; ignored while typing. */
export function useIssueNav(openIssues: Issue[], onSelect: (issue: Issue) => void) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const latest = useRef({ openIssues, onSelect, selectedId });
  useEffect(() => {
    latest.current = { openIssues, onSelect, selectedId };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "]" && e.key !== "[") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const { openIssues: list, onSelect: select, selectedId: cur } = latest.current;
      if (list.length === 0) return;
      const i = list.findIndex((x) => x.issue_id === cur);
      const next = e.key === "]" ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
      const issue = list[next];
      if (!issue) return;
      setSelectedId(issue.issue_id);
      select(issue);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { selectedId, setSelectedId };
}
