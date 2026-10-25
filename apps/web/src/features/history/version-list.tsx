import { CopyHashButton } from "./copy-hash-button";
import { COPY } from "./copy";
import {
  formatWhen,
  kindLabel,
  shortHash,
  stateWord,
  transitionFor,
  type AuditRow,
  type VersionEntry,
} from "./derive";

export interface VersionListProps {
  versions: VersionEntry[];
  audit: AuditRow[];
  selected: number;
  onSelect: (n: number) => void;
}

export function VersionList({
  versions,
  audit,
  selected,
  onSelect,
}: VersionListProps) {
  const sorted = [...versions].sort(
    (a, b) => a.version_number - b.version_number,
  );
  return (
    <ol aria-label={COPY.versionsHeading} className="flex flex-col gap-3">
      {sorted.map((v) => {
        const n = v.version_number;
        const isSelected = n === selected;
        const t = transitionFor(audit, v);
        return (
          <li
            key={v.version_id}
            aria-current={isSelected ? "true" : undefined}
            className={`border-hair rounded-md border p-3 ${isSelected ? "bg-selected" : "bg-panel"}`}
          >
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(n)}
              className="text-body text-ink text-left font-semibold"
            >
              {`v${n} · ${kindLabel(v)}`}
            </button>
            <p className="text-small text-ink2">{`By ${v.created_by} · ${formatWhen(v.created_at)}`}</p>
            <p className="text-small text-ink2">
              {t
                ? `${stateWord(t.from_state)} → ${stateWord(t.to_state)}`
                : COPY.noStateChange}
            </p>
            <p className="text-small text-ink2">
              {t?.reason ? t.reason : COPY.noReason}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                id={`hash-${n}`}
                title={v.content_hash}
                className="text-small text-ink"
              >
                {shortHash(v.content_hash)}
              </span>
              <CopyHashButton hash={v.content_hash} describedBy={`hash-${n}`} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
