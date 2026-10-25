// NL-91: unit coverage matrix (CON-22, WF-18). A deterministic read of stored alignment links: no model, no write, no clock.
// Names and minutes never enter this file: the board rows are copied down to lesson_id and number only (GR-15).
import { DomainRefusal } from "@ls/core/errors";
import type { AlignmentRepo, CoverageCell } from "@ls/core/ports/alignment";
import type { BoardReadRepo } from "@ls/core/ports/board-reads";
import type { RequestUser, UnitId } from "@ls/core/ports/common";
import type { StandardRepo } from "@ls/core/ports/standards";
import type { CoverageMatrix } from "@ls/schema/api/metrics";

export interface UnitExists {
  unit_exists(unit_id: UnitId): Promise<boolean>;
}

type Role = CoverageCell["role"];
type Confirmation = CoverageCell["confirmation"];
const ROLE_ORDER: readonly Role[] = ["I", "P", "A"];

const by_text = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// One (code, lesson) pair can have a row per role, and each role row has its own confirmation. The pair reads as
// `person` only when every role row is person; otherwise the first non-person value in the order
// judge_only, generator_only wins. (No role is promoted by another role's confirmation.)
function merge_confirmation(all: readonly Confirmation[]): Confirmation {
  if (all.every((c) => c === "person")) return "person";
  return all.includes("judge_only") ? "judge_only" : "generator_only";
}

export class CoverageService {
  constructor(
    private readonly alignment: AlignmentRepo,
    private readonly lessons: BoardReadRepo,
    private readonly standards: StandardRepo,
    private readonly units: UnitExists,
  ) {}

  async coverage(_user: RequestUser, unit_id: UnitId): Promise<CoverageMatrix> {
    const [exists, cells, board] = await Promise.all([
      this.units.unit_exists(unit_id),
      this.alignment.coverage_rows(unit_id),
      this.lessons.board_rows(unit_id, null),
    ]);
    if (!exists) throw new DomainRefusal("NOT_FOUND", "Not found.");

    const pairs = new Map<string, { code: string; lesson_id: string; roles: Set<Role>; conf: Confirmation[]; source: CoverageCell["source"] }>();
    for (const c of cells) {
      const key = `${c.code}\u0000${c.lesson_id}`;
      const p = pairs.get(key) ?? { code: c.code, lesson_id: c.lesson_id, roles: new Set<Role>(), conf: [], source: c.source };
      p.roles.add(c.role);
      p.conf.push(c.confirmation);
      pairs.set(key, p);
    }
    const out_cells = [...pairs.values()]
      .sort((a, b) => by_text(a.code, b.code) || by_text(a.lesson_id, b.lesson_id))
      .map((p) => ({
        code: p.code,
        lesson_id: p.lesson_id,
        roles: ROLE_ORDER.filter((r) => p.roles.has(r)),
        confirmed_by: merge_confirmation(p.conf),
        source: p.source,
      }));

    const codes = [...new Set(out_cells.map((c) => c.code))].sort(by_text);
    const assessed = new Set(out_cells.filter((c) => c.roles.includes("A")).map((c) => c.code));
    const texts = codes.length === 0 ? [] : await this.standards.texts(codes);
    const text_of = new Map(texts.map((s) => [s.code, s.text]));

    return {
      standards: codes.map((code) => ({ code, official_text: text_of.get(code) ?? "", never_assessed: !assessed.has(code) })),
      lessons: board.map((r) => ({ lesson_id: r.lesson_id, number: r.number })),
      cells: out_cells,
    };
  }
}
