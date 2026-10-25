export function LoadingSkeleton() {
  return (
    <div role="status" aria-busy="true" data-testid="workspace-skeleton" className="grid gap-6 lg:grid-cols-[var(--layout-outline)_minmax(0,1fr)]">
      <span className="sr-only">Loading lesson</span>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} data-testid="skeleton-outline-item" className="bg-well h-8 rounded-md" />
        ))}
      </div>
      <div className="bg-panel border-hair flex flex-col gap-3 rounded-xl border p-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} data-testid="skeleton-line" className="bg-well h-4 rounded-sm" />
        ))}
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} data-testid="skeleton-issue" className="bg-well h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
