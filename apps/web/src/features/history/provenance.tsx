import { COPY } from "./copy";
import { kindLabel, provenanceRows, type VersionEntry } from "./derive";

export function Provenance({ version }: { version: VersionEntry }) {
  const from = version.provenance.derived_from_version_id;
  return (
    <div>
      <p className="text-small text-ink2">{`v${version.version_number} · ${kindLabel(version)}`}</p>
      <dl className="mt-2 flex flex-col gap-2">
        {provenanceRows(version).map((r) => (
          <div key={r.key}>
            <dt className="text-small text-ink2">{r.label}</dt>
            {r.state === "present" ? (
              <dd className="text-small text-ink break-all">{r.value}</dd>
            ) : r.state === "na" ? (
              <dd className="text-small text-ink2">{COPY.notApplicable}</dd>
            ) : (
              <dd className="text-small text-danger font-semibold">
                {COPY.missing}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {from ? (
        <p className="text-small text-ink2 mt-2">{`Made from ${from}`}</p>
      ) : null}
    </div>
  );
}
