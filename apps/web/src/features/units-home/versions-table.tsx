import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { Link } from "@/components/ui/link";
import type { components } from "@/lib/api-types";
import { formatUploaded, routes, shortHash } from "./format";

type OutlineVersion = components["schemas"]["OutlineVersion"];

export function VersionsTable({ unitKey, versions }: { unitKey: string; versions: OutlineVersion[] }) {
  const r = routes(unitKey);
  const repeated = versions.filter((v) => v.same_as_version !== null);
  return (
    <div className="flex flex-col gap-2">
      <Table caption="Outline versions">
        <Thead>
          <Tr>
            <Th>Version</Th>
            <Th>File</Th>
            <Th>Uploaded by</Th>
            <Th>Date</Th>
            <Th>Hash</Th>
            <Th>Report</Th>
          </Tr>
        </Thead>
        <Tbody>
          {versions.map((v) => (
            <Tr key={v.outline_version_id}>
              <Td>{`v${v.version_number}`}</Td>
              <Td>{`Outline sheet · ${v.row_counts.lessons} lessons`}</Td>
              <Td>{v.created_by}</Td>
              <Td>{formatUploaded(v.created_at)}</Td>
              <Td>
                <code>{shortHash(v.sha256)}</code>
                {v.same_as_version !== null ? (
                  <span className="text-small text-ink2 block">{`same as v${v.same_as_version}`}</span>
                ) : null}
              </Td>
              <Td>
                <Link href={r.report(v.version_number)} aria-label={`Validation report, version ${v.version_number}`}>
                  {`Report v${v.version_number}`}
                </Link>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {repeated.length > 0 ? (
        <ul className="text-small text-ink2">
          {repeated.map((v) => (
            <li key={v.outline_version_id}>
              {`Version ${v.version_number} is the same as version ${v.same_as_version}; ${v.changed_lessons} ${v.changed_lessons === 1 ? "lesson" : "lessons"} changed.`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
