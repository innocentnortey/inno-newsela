import { useMemo } from "react";
import { Link } from "@/components/ui/link";
import { Table, Tbody, Th, Thead, Tr } from "@/components/ui/table";
import { lessonKeyFromId } from "@/lib/keys";
import { CoverageCell } from "./cell";
import {
  COPY,
  lessonColumnLabel,
  sortLessons,
  type Cell,
} from "./copy";
import { StandardRowHeader } from "./row-header";
import type { CoverageData } from "./use-coverage";

const STICKY = "bg-panel border-hair sticky left-0 z-[calc(var(--z-sticky)+1)] min-w-[16rem] border-r";

export function CoverageMatrix({
  data,
  unitKey,
  selected,
}: {
  data: CoverageData;
  unitKey: string;
  selected: string | null;
}) {
  const lessons = useMemo(() => sortLessons(data.lessons), [data.lessons]);
  const byCell = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of data.cells) m.set(`${c.code}|${c.lesson_id}`, c);
    return m;
  }, [data.cells]);

  return (
    <Table caption={COPY.caption}>
      <Thead>
        <Tr>
          <Th className={STICKY}>{COPY.standardCol}</Th>
          {lessons.map((l) => {
            const key = lessonKeyFromId(l.lesson_id);
            const label = lessonColumnLabel(l);
            return (
              <Th key={l.lesson_id} scope="col" className="min-w-[7rem]">
                {key ? (
                  <Link href={`/units/${unitKey}/lessons/${key}`}>{label}</Link>
                ) : (
                  label
                )}
              </Th>
            );
          })}
        </Tr>
      </Thead>
      <Tbody>
        {data.standards.map((s) => {
          const isSel = selected === s.code;
          return (
            <Tr
              key={s.code}
              aria-current={isSel ? "true" : undefined}
              data-code={s.code}
            >
              <StandardRowHeader standard={s} selected={isSel} />
              {lessons.map((l) => (
                <CoverageCell
                  key={l.lesson_id}
                  cell={byCell.get(`${s.code}|${l.lesson_id}`)}
                  selected={isSel}
                />
              ))}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
