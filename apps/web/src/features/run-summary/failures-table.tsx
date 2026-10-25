import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import type { components } from "@/lib/api-types";

type Rows = components["schemas"]["RunSummary"]["failures_by_reason"];

export function FailuresTable({ rows }: { rows: Rows }) {
  return (
    <Table caption="Failures by reason">
      <Thead>
        <Tr>
          <Th>Reason</Th>
          <Th numeric>Count</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.length === 0 ? (
          <Tr>
            <Td colSpan={2}>No failures.</Td>
          </Tr>
        ) : (
          rows.map((r) => (
            <Tr key={r.reason}>
              <Td>{r.reason}</Td>
              <Td numeric>{r.count}</Td>
            </Tr>
          ))
        )}
      </Tbody>
    </Table>
  );
}
