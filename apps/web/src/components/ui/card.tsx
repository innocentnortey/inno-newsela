import { useId, type ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className="bg-panel border-hair shadow-e1 rounded-xl border p-(--space-4)"
    >
      {title ? (
        <h3 id={titleId} className="text-label text-ink2 mb-2">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export interface MetricTileProps {
  title: string;
  /** `null` means nothing to show yet: no number is rendered. */
  value: string | null;
  unit?: string;
  caption?: string;
  note?: string;
}

export function MetricTile({ title, value, unit, caption, note }: MetricTileProps) {
  return (
    <Card title={title}>
      {value === null ? (
        <p className="text-title-sm text-ink2">No approved lessons yet</p>
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="text-display text-ink tabular-nums">{value}</span>
          {unit ? <span className="text-title-sm text-ink2">{unit}</span> : null}
          {note ? <span className="text-small text-ink2 ml-auto">{note}</span> : null}
        </p>
      )}
      {caption ? <p className="text-small text-ink3 mt-2">{caption}</p> : null}
    </Card>
  );
}
