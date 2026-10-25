export function CandidateSkeleton() {
  return (
    <div role="status" aria-label="Loading the candidate" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} aria-hidden="true" className="bg-well h-20 rounded-md motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
