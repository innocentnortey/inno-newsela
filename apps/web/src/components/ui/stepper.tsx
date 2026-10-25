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
    <div className="flex max-w-full flex-wrap items-center gap-3">
      <ol
        aria-label={ariaLabel}
        className="bg-panel border-hair shadow-e1 flex max-w-full flex-wrap items-center gap-2 rounded-2xl border py-2 pr-4 pl-3"
      >
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const now = n === current;
          return (
            <li key={label} aria-current={now ? "step" : undefined} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "text-label flex size-7 items-center justify-center rounded-full border",
                  done && "bg-success text-on-success border-transparent",
                  now && "bg-primary text-on-primary border-transparent ring-4 ring-[var(--color-selected)]",
                  !done && !now && "bg-panel border-edge text-ink2",
                )}
              >
                {done ? "✓" : n}
              </span>
              <span className="flex flex-col">
                <span aria-hidden="true" className="text-micro text-ink3">
                  Step {n}/5
                </span>
                <span className={cn("text-small", now ? "font-semibold" : "text-ink2 font-medium")}>{label}</span>
                {now ? <span className="sr-only">{`Step ${n} of 5, ${label}`}</span> : null}
              </span>
              {n < 5 ? <span aria-hidden="true" className="bg-hair h-[1.5px] w-6" /> : null}
            </li>
          );
        })}
      </ol>
      {offPath}
    </div>
  );
}
