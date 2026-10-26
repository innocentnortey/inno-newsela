import { COPY, TILE_UNITS } from "./copy";
import type { UnitMetrics } from "./data";

export type QualityTile = NonNullable<UnitMetrics["quality"]>["tiles"][number];

export function Tile({ tile }: { tile: QualityTile }) {
  const none = tile.n === 0 || tile.value === null;
  const unit = TILE_UNITS[tile.id];
  return (
    <li className="bg-panel border-hair shadow-e1 flex flex-col gap-1 rounded-xl border p-(--space-4)">
      <span className="text-label text-ink2">{tile.label}</span>
      {none ? (
        <span className="text-title-sm text-ink2">{COPY.empty}</span>
      ) : (
        <span className="text-display text-ink tabular-nums">
          {String(tile.value)}
          {unit ? <span className="text-title-sm text-ink2"> {unit}</span> : null}
        </span>
      )}
      <span className="text-small text-ink3 tabular-nums">{`n = ${tile.n}`}</span>
    </li>
  );
}
