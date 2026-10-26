import { cn } from "@/lib/cn";
import { changesHeading, COPY, versionHeading } from "./copy";
import { parseDiff } from "./diff";
import type { GuidanceVersion } from "./use-guidance";
import { whenText } from "./versions-list";

const TONE = { add: "text-success", remove: "text-danger", same: "text-ink" };

export function VersionView({ version }: { version: GuidanceVersion }) {
  const lines = parseDiff(version.diff);
  return (
    <section aria-labelledby="pg-version" className="flex flex-col gap-2">
      <h2 id="pg-version" className="text-ink text-lg font-semibold">
        {versionHeading(version.number)}
      </h2>
      <p className="text-small text-ink2">
        {`${version.author} · ${whenText(version.created_at)} · ${version.reason}`}
      </p>
      {version.number > 1 ? (
        <h3 className="text-label text-ink2">
          {changesHeading(version.number)}
        </h3>
      ) : null}
      {lines.length === 0 ? (
        <p className="text-body text-ink">{COPY.firstVersion}</p>
      ) : (
        <pre
          role="group"
          aria-label={changesHeading(version.number)}
          tabIndex={0}
          className="bg-well text-small overflow-x-auto rounded-md p-3 whitespace-pre-wrap"
        >
          {lines.map((l, i) => (
            <span
              key={i}
              data-diff={l.kind}
              className={cn("block", TONE[l.kind])}
            >
              {`${l.kind === "add" ? "+ " : l.kind === "remove" ? "- " : "  "}${l.text}`}
            </span>
          ))}
        </pre>
      )}
    </section>
  );
}
