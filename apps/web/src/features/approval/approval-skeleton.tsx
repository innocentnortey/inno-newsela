import { COPY } from "./copy";

function Block({ className }: { className: string }) {
  return <div aria-hidden="true" className={`bg-well rounded-md motion-safe:animate-pulse ${className}`} />;
}

export function ApprovalSkeleton() {
  return (
    <div role="status" aria-label={COPY.loading} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--layout-rail)]">
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Block key={i} className="h-14" />
        ))}
      </div>
      <Block className="h-64" />
    </div>
  );
}

export function TextSkeleton() {
  return (
    <div role="status" aria-label="Loading the lesson text" className="flex flex-col gap-2">
      <Block className="h-4 w-3/4" />
      <Block className="h-4" />
      <Block className="h-4 w-5/6" />
      <Block className="h-4" />
    </div>
  );
}
