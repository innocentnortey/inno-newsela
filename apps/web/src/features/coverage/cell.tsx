import { Td } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import {
  COPY,
  cellName,
  confirmedMark,
  orderedRoles,
  type Cell,
} from "./copy";

/** One standard x lesson cell. The server's roles, confirmer and source, shown as given. */
export function CoverageCell({
  cell,
  selected = false,
}: {
  cell?: Cell;
  selected?: boolean;
}) {
  const cls = cn("min-w-[7rem]", selected && "bg-well");
  if (!cell)
    return (
      <Td className={cls}>
        <span aria-hidden>–</span>
        <span className="sr-only">{COPY.notTaught}</span>
      </Td>
    );
  return (
    <Td className={cls}>
      <span aria-hidden className="text-ink font-mono font-semibold">
        {orderedRoles(cell.roles).join(" ")}
      </span>{" "}
      <span aria-hidden className="text-ink2 block text-[12px]">
        {confirmedMark(cell.confirmed_by)}
      </span>
      <span className="sr-only">{cellName(cell)}</span>
    </Td>
  );
}
