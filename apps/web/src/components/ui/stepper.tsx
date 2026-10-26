import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STEPS } from "./status";

export interface StepperProps {
  current: 1 | 2 | 3 | 4 | 5;
  /** Off-path pill (changes requested, failed) shown beside the stepper. */
  offPath?: ReactNode;
  "aria-label"?: string;
}

export function Stepper({ current, offPath, "aria-label": ariaLabel = "Lesson progress" }: StepperProps) {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
      {/* Look sheet M3: one line from md up; it wraps only on phones. */}
      <ol
        aria-label={ariaLabel}
        className="bg-panel border-hair shadow-e1 flex max-w-full flex-wrap items-center gap-2.5 rounded-2xl border py-2 pr-3.5 pl-2.5 md:flex-nowrap"
      >
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const now = n === current;
          return (
            <li key={label} aria-current={now ? "step" : undefined} className="flex shrink-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "text-label flex size-7 items-center justify-center rounded-full border",
                  done && "bg-success text-on-success border-transparent",
                  now && "bg-primary text-on-primary border-transparent ring-4 ring-[var(--color-selected)]",
                  !done && !now && "bg-panel border-edge border-[1.5px]",
                )}
              >
                {done ? (
                  <svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5 9.5 17 19 7.5" />
                  </svg>
                ) : now ? (
                  <svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4L19 9l-4-4L4 16z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                ) : null}
              </span>
              <span className="flex flex-col">
                <span aria-hidden="true" className="text-micro text-ink3">
                  {now ? `Step ${n}/5 · now` : `Step ${n}/5`}
                </span>
                <span className={cn("text-small", now ? "font-semibold" : "text-ink2 font-medium")}>{label}</span>
                {now ? <span className="sr-only">{`Step ${n} of 5, ${label}`}</span> : null}
              </span>
              {n < 5 ? <span aria-hidden="true" className="bg-hair h-[1.5px] w-[22px]" /> : null}
            </li>
          );
        })}
      </ol>
      {offPath}
    </div>
  );
}
