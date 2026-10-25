import { Glyph } from "@/components/ui/glyph";
import { Link } from "@/components/ui/link";
import { StatusPill } from "@/components/ui/status-pill";
import type { StatusKey } from "@/components/ui/status";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { RowNote } from "./row-note";
import { lessonHref } from "./row-href";

type BoardRow = components["schemas"]["BoardRow"];

const Dash = () => <span className="text-ink3">—</span>;

export function BoardTable({
  rows,
  unitKey,
  role,
  runId,
}: {
  rows: BoardRow[];
  unitKey: string;
  role: Role;
  runId: string | null;
}) {
  return (
    <Table caption="Lessons in this unit, sorted by blocking issues" captionHidden>
      <Thead>
        <Tr>
          <Th>Lesson</Th>
          <Th>Type</Th>
          <Th>State</Th>
          <Th numeric sort="descending">
            Blocking
          </Th>
          <Th numeric>Advisory</Th>
          <Th>Reviewer</Th>
          <Th>Note</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row) => {
          const failed = row.state === "generation_failed";
          const blocking = row.blocking_count + row.confirmation_count;
          return (
            <Tr key={row.lesson_id}>
              <Td>
                <Link href={lessonHref(unitKey, role, row)}>{row.title}</Link>
              </Td>
              <Td>{row.type}</Td>
              <Td>
                <StatusPill status={`lesson.${row.state}` as StatusKey} />
              </Td>
              <Td numeric>
                {failed ? (
                  <Dash />
                ) : (
                  <span className={`inline-flex items-center gap-1 ${blocking > 0 ? "text-danger" : "text-ink3"}`}>
                    {blocking > 0 ? <Glyph shape="octagon-bar" /> : null}
                    {blocking}
                    <span className="sr-only"> blocking</span>
                  </span>
                )}
              </Td>
              <Td numeric>
                {failed ? <Dash /> : <span className={row.advisory_count > 0 ? "text-warn" : "text-ink3"}>{row.advisory_count}</span>}
              </Td>
              <Td>{row.reviewer ?? <Dash />}</Td>
              <Td>
                <RowNote row={row} unitKey={unitKey} role={role} runId={runId} />
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
