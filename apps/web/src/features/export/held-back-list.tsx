import type { ExportList } from "./use-exports";
import { COPY, heldBackText } from "./copy";

export function HeldBackList({ items }: { items: ExportList["held_back"] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label text-ink2">{COPY.heldBackLabel}</h2>
      <ul aria-label={COPY.heldBackLabel} className="flex flex-col gap-1">
        {items.map((h) => (
          <li key={h.lesson_id} className="text-body text-ink">
            {heldBackText(h.lesson_id, h.waits_on)}
            <span className="text-small text-ink2"> · {h.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
