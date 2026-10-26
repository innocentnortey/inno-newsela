import { GROUPS, OTHER_GROUP } from "./copy";
import { Tile, type QualityTile } from "./tile";

export interface TileGroup {
  key: string;
  heading: string;
  tiles: QualityTile[];
}

/** Groups by the id prefix letter, keeping response order. Unknown prefixes go to "Other", never dropped. */
export function groupTiles(tiles: readonly QualityTile[]): TileGroup[] {
  const groups: TileGroup[] = GROUPS.map((g) => ({ key: g.prefix, heading: g.heading, tiles: [] }));
  const other: TileGroup = { key: "other", heading: OTHER_GROUP, tiles: [] };
  for (const t of tiles) {
    const g = groups.find((x) => t.id.startsWith(`${x.key}-`));
    (g ?? other).tiles.push(t);
  }
  return [...groups, other].filter((g) => g.tiles.length > 0);
}

export function TileGroups({ tiles }: { tiles: readonly QualityTile[] }) {
  return (
    <>
      {groupTiles(tiles).map((g) => (
        <section key={g.key} aria-labelledby={`tiles-${g.key}`} className="flex flex-col gap-3">
          <h2 id={`tiles-${g.key}`} className="text-title-sm text-ink">
            {g.heading}
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {g.tiles.map((t) => (
              <Tile key={t.id} tile={t} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
