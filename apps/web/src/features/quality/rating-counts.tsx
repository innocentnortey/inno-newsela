import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { COPY } from "./copy";
import type { UnitMetrics } from "./data";

type Ratings = NonNullable<UnitMetrics["quality"]>["rating_counts"];

export function RatingCounts({ ratings }: { ratings: Ratings }) {
  if (ratings.n === 0)
    return (
      <section aria-labelledby="ratings-h" className="flex flex-col gap-2">
        <h2 id="ratings-h" className="text-title-sm text-ink">
          {COPY.ratingsCaption}
        </h2>
        <p className="text-body text-ink2">{COPY.empty}</p>
        <p className="text-small text-ink3 tabular-nums">{`n = ${ratings.n}`}</p>
      </section>
    );
  const rows: [string, number][] = [
    [COPY.usable, ratings.usable_as_drafted],
    [COPY.usableWithEdits, ratings.usable_with_edits],
    [COPY.rewritten, ratings.rewritten],
  ];
  return (
    <section className="flex flex-col gap-2">
      <Table caption={COPY.ratingsCaption}>
        <Thead>
          <Tr>
            <Th>Rating</Th>
            <Th numeric>Lessons</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map(([label, count]) => (
            <Tr key={label}>
              <Th scope="row" className="text-body text-ink">
                {label}
              </Th>
              <Td numeric>{String(count)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <p className="text-small text-ink3 tabular-nums">{`n = ${ratings.n}`}</p>
    </section>
  );
}
