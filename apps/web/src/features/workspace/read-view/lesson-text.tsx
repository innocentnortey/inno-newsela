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
            <h2 id={headingId} className="text-ink text-label font-semibold">
              {s.name}
              {s.minutes > 0 ? <span className="text-ink2 font-normal">{` · ${s.minutes} min`}</span> : null}
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
