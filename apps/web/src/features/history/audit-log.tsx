import { COPY } from "./copy";
import { auditLine, type AuditRow } from "./derive";

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-ink mb-2 text-sm font-semibold">
        {COPY.auditHeading}
      </h3>
      {rows.length === 0 ? (
        <p className="text-small text-ink2">{COPY.noAudit}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`} className="text-small text-ink">
              {auditLine(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
