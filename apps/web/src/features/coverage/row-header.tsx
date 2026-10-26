import { CodeChip } from "@/components/ui/badge";
import { Glyph } from "@/components/ui/glyph";
import { Th } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { COPY } from "./copy";

export interface Standard {
  code: string;
  official_text: string;
  never_assessed: boolean;
}

/** The sticky first cell of a row: the code and the official text exactly as returned. */
export function StandardRowHeader({
  standard,
  selected = false,
}: {
  standard: Standard;
  selected?: boolean;
}) {
  return (
    <Th
      scope="row"
      aria-current={selected ? "true" : undefined}
      className={cn(
        "bg-panel border-hair text-body text-ink sticky left-0 z-[var(--z-sticky)] min-w-[16rem] border-r pt-3 font-normal whitespace-normal",
        selected && "bg-well",
      )}
    >
      <div className="flex flex-col items-start gap-1">
        <CodeChip>{standard.code}</CodeChip>
        <span className="normal-case tracking-normal">
          {standard.official_text}
        </span>
        {standard.never_assessed ? (
          <span className="text-warn inline-flex items-center gap-1">
            <Glyph shape="triangle-bang" className="text-warn shrink-0" />
            {COPY.neverAssessed}
          </span>
        ) : null}
      </div>
    </Th>
  );
}
