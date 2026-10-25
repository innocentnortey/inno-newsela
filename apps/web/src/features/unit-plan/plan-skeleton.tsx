export function PlanSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading the unit plan</span>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            data-skeleton="entry"
            className="bg-well h-20 rounded-md"
          />
        ))}
      </div>
    </div>
  );
}
