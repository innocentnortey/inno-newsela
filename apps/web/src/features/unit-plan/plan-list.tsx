"use client";

import { useEffect } from "react";
import { Link } from "@/components/ui/link";
import type { components } from "@/lib/api-types";
import { lessonHref, lessonTitle, sortByDay } from "./plan-copy";

type PlanEntry = components["schemas"]["PlanEntry"];

export function PlanList({
  entries,
  unitKey,
  focusDay,
}: {
  entries: PlanEntry[];
  unitKey: string;
  focusDay: number | null;
}) {
  useEffect(() => {
    if (focusDay == null) return;
    const el = document.getElementById(`day-${focusDay}`);
    if (!el) return;
    el.scrollIntoView?.({ block: "start" });
    el.focus();
  }, [focusDay]);

  return (
    <ol aria-label="Teaching days" className="flex flex-col gap-4">
      {sortByDay(entries).map((e) => {
        const href = lessonHref(unitKey, e.lesson_id);
        const title = lessonTitle(e.lesson_id);
        return (
          <li
            key={e.lesson_id}
            id={`day-${e.day}`}
            tabIndex={-1}
            data-day={e.day}
            className="border-hair focus-visible:outline-primary scroll-mt-(--layout-top-bar) rounded-lg border p-(--space-4) focus-visible:outline-2"
          >
            <p className="text-caps text-ink3 uppercase">Day {e.day}</p>
            <h2 className="text-title-sm text-ink">
              {href ? <Link href={href}>{title}</Link> : title}
            </h2>
            <p className="text-body text-ink">{e.purpose}</p>
            <p className="text-small text-ink2">
              Hands forward: {e.hands_forward}
            </p>
            {e.performance_task_thread ? (
              <span className="bg-selected text-primary text-label inline-flex rounded-sm px-1.5 py-px">
                {e.performance_task_thread}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
