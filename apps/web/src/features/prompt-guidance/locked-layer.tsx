import { COPY } from "./copy";

/** Read-only by design (R-38): a plain text node, no input, no button. */
export function LockedLayer({ text }: { text: string }) {
  return (
    <section aria-labelledby="pg-locked" className="flex flex-col gap-2">
      <h2 id="pg-locked" className="text-ink text-lg font-semibold">
        {COPY.lockedTitle}
      </h2>
      <pre
        tabIndex={0}
        className="bg-well text-small text-ink rounded-md p-3 whitespace-pre-wrap"
      >
        {text}
      </pre>
    </section>
  );
}
