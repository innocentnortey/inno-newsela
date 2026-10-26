import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { COPY } from "./copy";
import type { UnitMetrics } from "./data";

type Seeded = NonNullable<UnitMetrics["quality"]>["seeded_errors"];

export function SeededErrors({ seeded }: { seeded: Seeded }) {
  return (
    <section className="flex flex-col gap-2">
      <Table caption={COPY.seededCaption}>
        <Thead>
          <Tr>
            <Th>Checked by</Th>
            <Th numeric>{COPY.planted}</Th>
            <Th numeric>{COPY.caught}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Th scope="row" className="text-body text-ink">
              {seeded.label}
            </Th>
            <Td numeric>{String(seeded.planted)}</Td>
            <Td numeric>{String(seeded.caught)}</Td>
          </Tr>
        </Tbody>
      </Table>
    </section>
  );
}
