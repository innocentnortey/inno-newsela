import { COPY } from "./copy";

function Block({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-well rounded-md motion-safe:animate-pulse ${className}`}
    />
  );
}

export function HistorySkeleton() {
  return (
    <div
      role="status"
      aria-label={COPY.loading}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--layout-rail)]"
    >
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Block key={i} className="h-24" />
        ))}
      </div>
      <Block className="h-64" />
    </div>
  );
}
