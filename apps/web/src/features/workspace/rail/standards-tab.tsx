"use client";
import type { ReactNode } from "react";
import { CodeChip } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { components } from "@/lib/api-types";
import { addressLabel } from "./issue-labels";

type Lesson = components["schemas"]["Lesson"];
type Standard = components["schemas"]["Standard"];

const ORIGIN_TEXT: Record<Standard["origin"], string> = {
  outline: "from the outline",
  "outline-fixed": "outline, fixed",
  narrowed: "AI-proposed · confirm",
  added: "AI-proposed · confirm",
};

function originText(s: Standard): string {
  const base = ORIGIN_TEXT[s.origin];
  if (s.confirmation === "confirmed") return `${base} · confirmed`;
  if (s.confirmation === "removed") return `${base} · removed`;
  return base;
}

export interface StandardsTabProps {
  lesson: Lesson;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  /** SLOT NL-64: Confirm / Remove buttons per standard, rendered outside the row button. */
  renderActions?: (std: Standard) => ReactNode;
}

export function StandardsTab({ lesson, selectedCode, onSelect, renderActions }: StandardsTabProps) {
  const standards = lesson.front_matter.standards;
  const active = standards.find((s) => s.code === selectedCode) ?? standards[0];
  const labels = (links: string[]) => (links.length ? links.map((a) => addressLabel(a, lesson.sections)).join(", ") : "none");
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {standards.map((s) => {
          const entry = lesson.alignment_map.find((a) => a.code === s.code);
          return (
            <li key={s.code} className="flex flex-col gap-2">
              <button
                type="button"
                aria-pressed={s.code === active?.code}
                onClick={() => onSelect(s.code)}
                className={cn(
                  "border-hair flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left",
                  s.code === active?.code ? "bg-selected" : "bg-panel",
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <CodeChip>{s.code}</CodeChip>
                  <span className="text-small">{originText(s)}</span>
                </span>
                {entry ? (
                  <span className="text-small text-ink2">{`taught: ${labels(entry.teach_links)} · checked: ${labels(entry.check_links)}`}</span>
                ) : null}
                <span className="text-small text-ink2">{`asserted by ${entry?.asserted_by ?? s.asserted_by}`}</span>
              </button>
              {renderActions?.(s)}
            </li>
          );
        })}
      </ul>
      {active ? (
        <div className="bg-well rounded-lg p-3">
          <p className="text-small mb-1 flex items-center gap-2 font-semibold">
            Official text · <CodeChip>{active.code}</CodeChip>
          </p>
          <blockquote className="text-small">{active.official_text}</blockquote>
        </div>
      ) : null}
    </div>
  );
}
