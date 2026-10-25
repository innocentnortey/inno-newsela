import { Button } from "@/components/ui/button";
import { newCtx, renderDoc } from "@/features/workspace/read-view/render-doc";
import { ADOPT_SECTION, NOT_IN_VERSION } from "./copy";
import type { Section } from "./derive";

export interface SectionCellProps {
  section: Section | null;
  side: "current" | "candidate";
  /** "Candidate v4": names the candidate side for assistive tech. */
  versionLabel: string;
  address: string;
  name: string;
  adoptedBy?: string;
  canAdopt: boolean;
  busy: string | null;
  onAdopt: (address: string, name: string) => void;
}

export function SectionCell({ section, side, versionLabel, address, name, adoptedBy, canAdopt, busy, onAdopt }: SectionCellProps) {
  const ctx = newCtx();
  ctx.counters.headingLast = 2;
  ctx.sectionAddress = address;
  const group = side === "current" ? `Current: ${name}` : `${versionLabel}: ${name}`;
  const minutes = section && section.minutes > 0 ? ` · ${section.minutes} min` : "";
  return (
    <div role="group" aria-label={group} className="flex min-w-0 flex-col gap-3">
      <h2 className="text-label text-ink font-semibold">
        {name}
        {minutes}
      </h2>
      {section ? (
        <div className="text-body text-ink flex flex-col gap-3">{renderDoc(section.content, ctx)}</div>
      ) : (
        <p className="text-small text-ink2">{NOT_IN_VERSION}</p>
      )}
      {side === "candidate" && section ? (
        adoptedBy ? (
          <p className="text-small text-success">Adopted by {adoptedBy}</p>
        ) : canAdopt ? (
          <div>
            <Button
              variant="secondary"
              size="sm"
              loading={busy === address}
              disabled={busy !== null}
              onClick={() => onAdopt(address, name)}
              aria-label={`${ADOPT_SECTION}: ${name}`}
            >
              {ADOPT_SECTION}
            </Button>
          </div>
        ) : null
      ) : null}
    </div>
  );
}
