import { Link } from "@/components/ui/link";
import { StatusPill } from "@/components/ui/status-pill";
import type { StatusKey } from "@/components/ui/status";
import type { components } from "@/lib/api-types";
import { failureLine } from "./run-copy";

type Tile = components["schemas"]["Tile"];

export function TileGrid({
  tiles,
  unitKey,
}: {
  tiles: Tile[];
  unitKey: string;
}) {
  return (
    <ul
      aria-label="Lessons in this run"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {tiles.map((t) => (
        <li
          key={t.lesson_id}
          className="bg-panel border-hair flex flex-col items-start gap-2 rounded-xl border p-4"
        >
          <span className="text-label text-ink2">
            {t.number != null ? `Lesson ${t.number}` : t.lesson_key}
          </span>
          <span className="text-body text-ink font-semibold">{t.title}</span>
          <StatusPill status={`tile.${t.tile_state}` as StatusKey} />
          {t.tile_state === "ready" && t.openable ? (
            <Link href={`/units/${unitKey}/lessons/${t.lesson_key}`}>
              Open<span className="sr-only"> {t.title}</span>
            </Link>
          ) : null}
          {t.tile_state === "failed" ? (
            <p className="text-small text-danger">{failureLine(t)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function TileSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="bg-well h-24 animate-pulse rounded-xl" />
      ))}
    </ul>
  );
}
