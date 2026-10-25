// Test support: builds a CheckContext from a fixture draft. Only test code imports this.
import { readFileSync } from "node:fs";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import { LessonDraft } from "@ls/schema/lesson-draft";
import type { NormalizedRow } from "@ls/schema/outline";
import { compile_draft } from "../../../../compile/compile-draft.ts";
import { template_for } from "../../../../compile/templates.ts";
import { normalize_outline } from "../../../../intake/normalize.ts";
import type { CellGrid } from "../../../../intake/parse-grid.ts";
import {
  load_issued_grid,
} from "../../../../../tests/fixtures/outline/index.ts";
import { standards_double } from "../../../../../tests/fixtures/outline/standards-double.ts";
import type { CheckContext } from "../../../types.ts";
import { make_ctx } from "../../../test-helpers.ts";

export type Fixture = "wp1" | "wp2" | "wp3" | "wp4";
const SHEET_ROW: Record<Fixture, number> = { wp1: 8, wp2: 9, wp3: 25, wp4: 39 };

const read = (p: URL): unknown => JSON.parse(readFileSync(p, "utf8"));

export function load_draft(name: Fixture): LessonDraft {
  const url =
    name === "wp2"
      ? new URL("./draft-wp2.json", import.meta.url)
      : new URL(`../../../../../tests/fixtures/draft-${name}.json`, import.meta.url);
  return LessonDraft.parse(read(url));
}

export function build_ctx(
  name: Fixture,
  opts: { grid?: CellGrid; mutate?: (draft: LessonDraft) => void } = {},
): CheckContext {
  const rows = normalize_outline(opts.grid ?? load_issued_grid(), standards_double, 200).rows;
  const idx = rows.findIndex((r) => r.row_number === SHEET_ROW[name]);
  const row = rows[idx] as NormalizedRow;
  const arc_header =
    rows
      .slice(0, idx)
      .reverse()
      .find((r) => r.kind === "arc_header")?.title ?? null;
  const draft = load_draft(name);
  opts.mutate?.(draft);
  const compiled = compile_draft(draft, {
    row,
    template: template_for(row.lesson_type)!,
    unit_id: "G6.U4" as UnitId,
    schema_version: SCHEMA_VERSION,
  });
  return {
    ...make_ctx(compiled.lesson),
    row,
    arc_header,
    text_cards: draft.text_cards,
    standards: [],
  };
}

export type Plant = {
  id: string;
  fixture: Fixture;
  expected_scan: "quote" | "page" | "name" | "none";
  code_detectable: boolean;
  op:
    | { op: "append_text"; block: number }
    | { op: "append_rationale"; block: number; index: number }
    | { op: "insert_block"; after: number; block: LessonDraft["blocks"][number] };
  text: string;
  needle: string;
  expected_kind: string | null;
};

export function load_plants(): Plant[] {
  const file = read(new URL("./plants.json", import.meta.url)) as { plants: Plant[] };
  return file.plants;
}

export function apply_plant(draft: LessonDraft, plant: Plant): void {
  const { op } = plant;
  if (op.op === "insert_block") {
    draft.blocks.splice(op.after + 1, 0, structuredClone(op.block));
    return;
  }
  const block = draft.blocks[op.block];
  if (block === undefined) throw new Error(`no block ${op.block}`);
  if (op.op === "append_text") {
    block.text += ` ${plant.text}`;
  } else if (block.cfu !== null) {
    block.cfu.rationales[op.index] += ` ${plant.text}`;
  }
}

export function build_planted(plant: Plant): CheckContext {
  return build_ctx(plant.fixture, { mutate: (d) => apply_plant(d, plant) });
}
