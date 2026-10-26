import { forwardRef } from "react";
import type { components } from "@/lib/api-types";
import { LessonDetails } from "./lesson-details";
import { newCtx, renderDoc } from "./render-doc";
import { TextCardView } from "./text-card";

type Lesson = components["schemas"]["Lesson"];

/** The server text of the lesson, drawn as React elements. NL-63 replaces the visible body with the live editor. */
export const LessonText = forwardRef<HTMLDivElement, { lesson: Lesson }>(function LessonText({ lesson }, ref) {
  const ctx = newCtx();
  return (
    <div ref={ref} data-testid="lesson-text" className="flex flex-col gap-6">
      <LessonDetails lesson={lesson} />
      {lesson.text_cards.map((c, i) => (
        <TextCardView key={i} card={c} />
      ))}
      {lesson.sections.map((s) => {
        const headingId = `sec-h-${s.address}`;
        ctx.counters.headingLast = 2;
        ctx.sectionAddress = s.address;
        return (
          <section key={s.address} id={`sec-${s.address}`} data-address={s.address} aria-labelledby={headingId} className="flex flex-col gap-2">
            {/* Look sheet M3: a label row (name · minutes at the right) over a hairline; the name reads "Launch · 5 min". */}
            <h2 id={headingId} className="text-ink3 text-label border-hair mt-4 flex justify-between gap-3 border-b pb-1.5 font-semibold">
              <span>{s.name}</span>
              {s.minutes > 0 ? (
                <span className="tabular-nums whitespace-nowrap">
                  <span className="sr-only"> · </span>
                  {`${s.minutes} min`}
                </span>
              ) : null}
            </h2>
            <div data-text-region tabIndex={-1} className="text-body text-ink flex flex-col gap-3 outline-offset-4">
              {renderDoc(s.content, ctx)}
            </div>
          </section>
        );
      })}
    </div>
  );
});
