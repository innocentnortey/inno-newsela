import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import type { ExportList } from "./use-exports";
import { COPY, exportDate, versionLabel } from "./copy";

export function VersionsTable({
  rows,
  selected,
  onDownload,
}: {
  rows: ExportList["exports"];
  selected: string | null;
  onDownload: (exportId: string, version: number) => void;
}) {
  const sorted = [...rows].sort((a, b) => b.version_number - a.version_number);
  const current = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView?.({ block: "center" });
  }, [selected, rows.length]);
  return (
    <Table caption={COPY.versionsCaption}>
      <Thead>
        <Tr>
          <Th>{COPY.versionCol}</Th>
          <Th>{COPY.dateCol}</Th>
          <Th numeric>{COPY.lessonsCol}</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {sorted.map((v) => {
          const here = v.export_id === selected;
          return (
            <tr
              key={v.export_id}
              ref={here ? current : undefined}
              aria-current={here ? "true" : undefined}
              className={here ? "bg-selected" : undefined}
            >
              <Td>{versionLabel(v.version_number)}</Td>
              <Td>{exportDate(v.created_at)}</Td>
              <Td numeric>{v.lesson_count}</Td>
              <Td>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`${COPY.download} ${versionLabel(v.version_number)}`}
                  onClick={() => onDownload(v.export_id, v.version_number)}
                >
                  {COPY.download}
                </Button>
              </Td>
            </tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
