import type { Standard } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import type { StandardRow } from "@ls/core/ports/standards";
import { standards_for_lesson } from "@ls/core/compile/standard-identity";

/**
 * Delegates to the one core mapping (`compile/standard-identity.ts`). Focus, then MSLS (supporting), then ELD; de-duplicated; listed codes without an official text are skipped.
 * `tagged` are the codes the compiled headings name. Origin is decided here from the row, never from the model:
 * a tagged leaf of a listed parent is a narrowing that replaces the parent; any other unlisted tagged code is added.
 * Both start with an open confirmation and the generator as asserter. An unknown code is kept with empty text so
 * the checks surface it instead of dropping it.
 */
export function build_front_matter_standards(
  row: NormalizedRow,
  rows: readonly StandardRow[],
  tagged: readonly string[] = [],
): Standard[] {
  return standards_for_lesson(row, rows, tagged);
}
