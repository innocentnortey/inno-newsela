export function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} data-skeleton="row" className="bg-well h-12 rounded-md" />
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the unit board" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} data-skeleton="rollup-cell" className="bg-well h-16 rounded-md" />
          ))}
        </div>
        <div data-skeleton="tile" className="bg-well h-48 rounded-xl" />
      </div>
      <RowsSkeleton />
    </div>
  );
}
