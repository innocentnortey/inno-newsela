export function UnitsSkeleton() {
  return (
    <div data-testid="units-skeleton" aria-busy="true" className="flex flex-col gap-(--space-4)">
      <span className="sr-only">Loading units</span>
      <div className="bg-panel border-hair flex flex-col gap-2 rounded-xl border p-(--space-4)">
        <div className="bg-well h-4 rounded-sm motion-safe:animate-pulse" />
        <div className="bg-well h-4 rounded-sm motion-safe:animate-pulse" />
        <div className="bg-well h-4 rounded-sm motion-safe:animate-pulse" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} data-testid="units-skeleton-row" className="bg-well h-8 rounded-sm motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
