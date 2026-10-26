import { SideRail } from "@/components/layout/two-pane";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { COPY } from "./copy";
import type { GuidanceVersion } from "./use-guidance";

export const whenText = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "UTC" });

export function VersionsList({
  versions,
  selectedId,
}: {
  versions: GuidanceVersion[];
  selectedId: string | undefined;
}) {
  return (
    <SideRail title={COPY.railTitle}>
      <ul aria-label={COPY.railTitle} className="flex flex-col gap-1">
        {versions.map((v) => {
          const current = v.version_id === selectedId;
          return (
            <li key={v.version_id}>
              <Link
                href={`/prompt-guidance?version=${encodeURIComponent(v.version_id)}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex flex-col rounded-md px-2 py-1 font-normal no-underline",
                  current ? "bg-selected" : "hover:bg-well",
                )}
              >
                <span className="text-body text-ink font-semibold">{`v${v.number}`}</span>
                <span className="text-small text-ink2">{v.author}</span>
                <span className="text-small text-ink2">
                  {whenText(v.created_at)}
                </span>
                <span className="text-small text-ink">{v.reason}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SideRail>
  );
}
