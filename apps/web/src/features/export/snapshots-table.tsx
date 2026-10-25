import { CodeChip } from "@/components/ui/badge";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import type { ExportList } from "./use-exports";
import { COPY, lessonLabel } from "./copy";

export function SnapshotsTable({ rows }: { rows: ExportList["included"] }) {
  return (
    <Table caption={COPY.snapshotsCaption}>
      <Thead>
        <Tr>
          <Th>{COPY.lessonCol}</Th>
          <Th>{COPY.hashCol}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((r) => (
          <Tr key={r.lesson_id}>
            <Td>{lessonLabel(r.lesson_id)}</Td>
            <Td>
              <span title={r.approved_hash}>
                <CodeChip>{r.approved_hash.slice(0, 8)}</CodeChip>
              </span>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
