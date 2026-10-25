"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURRENT_CAPTION } from "./copy";
import type { Row } from "./derive";
import { SectionCell } from "./section-cell";

export interface CompareViewProps {
  rows: Row[];
  wide: boolean;
  versionLabel: string;
  canAdopt: boolean;
  adoptedBy: Record<string, string>;
  busy: string | null;
  onAdopt: (address: string, name: string) => void;
}

const FRAME = "bg-panel border-hair rounded-xl border px-4 py-2";

export function CompareView({ rows, wide, versionLabel, canAdopt, adoptedBy, busy, onAdopt }: CompareViewProps) {
  const cell = (r: Row, side: "current" | "candidate") => (
    <SectionCell
      section={side === "current" ? r.current : r.candidate}
      {...{ side, versionLabel, canAdopt, busy, onAdopt }}
      address={r.address}
      name={r.name}
      adoptedBy={adoptedBy[r.address]}
    />
  );
  if (wide) {
    return (
      <div className={FRAME}>
        <div className="grid grid-cols-2 gap-6 py-2">
          <p className="text-ink3 text-xs uppercase">{CURRENT_CAPTION}</p>
          <p className="text-ink3 text-xs uppercase">{versionLabel}</p>
        </div>
        {rows.map((r) => (
          <div key={r.address} id={`cmp-${r.address}`} tabIndex={-1} className="border-hair grid grid-cols-2 gap-6 border-t py-4">
            {cell(r, "current")}
            {cell(r, "candidate")}
          </div>
        ))}
      </div>
    );
  }
  return (
    <Tabs defaultValue="candidate" className={FRAME}>
      <TabsList>
        <TabsTrigger value="current">Current</TabsTrigger>
        <TabsTrigger value="candidate">Candidate</TabsTrigger>
      </TabsList>
      {(["current", "candidate"] as const).map((side) => (
        <TabsContent key={side} value={side}>
          {rows.map((r) => (
            <div key={r.address} id={`cmp-${r.address}`} tabIndex={-1} className="border-hair border-t py-4 first:border-t-0">
              {cell(r, side)}
            </div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
