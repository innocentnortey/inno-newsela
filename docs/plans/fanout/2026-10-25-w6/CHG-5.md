# CHG-5 — CON-3 report: list the unit-conflict finding; fill the ELD fields

Lane: `lane::build-loop`. risk::security: **no** (read-only presentation of stored data; no input, auth or secret surface). Planner: Opus-class, 2026-10-25. Ticket origin: defects 1 and 2 in `docs/devlog/2026-10-25-w6-nl94.md` (branch `ticket/NL-94`, worktree `/home/linuxuser/workspaces/.worktrees/newsela-NL-94`, NL-94 not yet merged: `grep -c NL-94 docs/plans/merged.txt` = 0).

## 1. Goal and sources
Make `getValidationReport` (CON-3) carry what SCR-4 needs, using only data already stored in `outline_json`:
1. **Unit conflict is listed.** `normalize.ts:133` stores it as `IntakeFinding { row_number: null, kind: "unit_conflict", original_text: <title cell>, proposed_fix: <unit_as_written>, default_choice: null }`. `report.ts` attaches findings to rows by `row_number`, so a null-row finding is in `counts` but in no `rows[].findings` and `unit` has no id. SCR-4 copy needs it: "The sheet says G6, U4; every filename says U3. → Confirm U4" and the button "Confirm U4 for the unit" (SCREEN_SPECS.md SCR-4, "Copy fixed by the flows" and Accessibility).
2. **ELD entries are filled** (CON-3 `eld`: `code`, `sheet_label`, `official_strand`, `verdict`, `suggested_remap`, `choice`; SCR-4 warnings: "*Keep · Re-map to `PII.6.2b`* … with the sheet's label and the official strand side by side").

Sources: `docs/contracts/INTERFACE.md` CON-3 (line 358) and CON-4 (411); `docs/contracts/CHANGES.md` (procedure; last row CHG-4); NL-77 ticket line 81 ("ELD `sheet_label` / `official_strand` are `""` until stored" — this slice supersedes that); NL-84 S1 golden (`evals/src/suites/s1-support.ts` calls `build_validation_report(VERSION, o, [])`).

## 2. Contract classification (CHANGES.md)
CHG-5 row, CON-3. Aspect: field. **Kind: additive, presentation-visible; no promise removed.** One new optional response field (`unit.finding`) and two existing fields (`eld[].sheet_label`, `eld[].official_strand`, `eld[].suggested_remap`) change from always-empty to filled; they were already in the card, so that part is behaviour-conforming bug fix, not a change. Decided by: orchestrator under PD-32 (same authority as CHG-2/3/4). No product behaviour invented: every value below is read from stored data. Waiting to reconcile: NL-57 and NL-77 notes; NL-94 (unmerged) to unskip its two `test.fixme` after this merges. If the orchestrator disagrees that this needs no Innocent decision, mark NEEDS-DECISION; I see none.

## 3. Boundary
Owned (create/modify):
- `packages/core/src/intake/report.ts`, `packages/core/src/intake/report.test.ts`
- `packages/schema/src/api/outlines.ts` (add field to `ValidationReport.unit`)
- `docs/contracts/interface.openapi.yaml` (`ValidationReport.unit` schema ~line 1898; examples: `unit:` lines at ~265 and every other `unit: {` example in the file, `grep -n "filenames_say" docs/contracts/interface.openapi.yaml`)
- `apps/web/src/lib/api-types.ts` (regenerate: `cd apps/web && npm run api:types`)
- `docs/contracts/INTERFACE.md` (CON-3 card: `unit` bullet + `eld` bullet), `docs/contracts/CHANGES.md` (CHG-5 row, status `reconciled`)
- `apps/web/src/server/services/outline-service.ts` (two call sites only: `report()` ~line 154 and `record_choice` ~line 210; pass the standards index)
- `apps/web/src/features/validation-report/report-model.ts`, `errors-section.tsx`, and their tests (`report-model.test.ts`, the errors-section test if present) — only the unit-conflict item wiring (see step 6)
- `docs/devlog/2026-10-25-chg-5.md` (new), `.claude/reference/area-map.md` (append one note to the A4 and A14 rows).
Read only: `packages/core/src/intake/normalize.ts`, `normalize-codes.ts`, `standards-index.ts`, `apps/web/src/server/services/outline-choices.ts`, `evals/src/suites/s1-support.ts`, `packages/schema/src/outline.ts`.
Must not touch: `evals/**` (NL-84's), `apps/web/e2e/**` (NL-94's, other branch), `normalize*.ts`, `outline-choices.ts`, any other CON card.

## 4. Shared code to use (real signatures)
- `build_validation_report(version: OutlineVersionRow, outline: NormalizedOutline, choices: readonly IntakeChoiceRow[]): ValidationReport` (report.ts). Existing callers: `outline-service.ts` (2), `evals/src/suites/s1-support.ts:98` (3 args), `report.test.ts`. **Keep 3 args valid** by adding an optional 4th.
- `StandardsIndex.strand_of(code: string): string | null` (standards-index.ts:103; returns `eld_strand` from seed `eld-6.json`, i.e. the official CDE strand). `this.standards.index()` (StandardRepo port) returns that index; `outline-service.ts:173` and `:247` already call it.
- Stored ELD finding: `check_eld_cell` makes `{kind:"eld_mismatch", original_text: <the sheet line "ELD.PI.6.7 – label">, proposed_fix: res.suggestion, default_choice:"eld_keep"}`. Line format regex (normalize-codes.ts:30): `/^\W*(ELD\.P(?:I|II)\.\d+\.?\d*[a-z]?)\s*[–-]\s*(.+?)\s*$/`.
- Zod: `Finding`, `EldEntry`, `NullableText` in `packages/schema/src/api/outlines.ts`.

## 5. Field sources (exactly)
| Field | Source (already stored) |
|---|---|
| `unit.finding` (new, `Finding \| null`) | the one `outline.findings` entry with `kind === "unit_conflict"` (level error), through the existing `report_finding(f, latest)` so `finding_id`, `level:"error"`, `kind`, `column:"Unit"` (already in `KIND_COLUMN`), `original_text` (title cell), `proposed_fix` (= `unit_as_written`), `choice` (default or confirmed) match every other finding. `null` when no conflict. At most one exists (`add(null, …)` once). |
| `eld[].sheet_label` | the label parsed from the code's own `eld_mismatch` finding `original_text` with the regex above (capture group 2). `""` when the code has no mismatch finding: the outline stores codes only for fitting lines, so the label is not stored and must not be invented. |
| `eld[].suggested_remap` | that finding's `proposed_fix` (already `null` when none). `null` when no mismatch. |
| `eld[].official_strand` | `lookup.strand_of(code) ?? ""` from the seeded standards index (CDE text, never the sheet label). No lookup passed → `""` (keeps S1 golden callers unchanged). |
| `eld[].verdict`, `choice` | unchanged. |
Also fix the match: replace `f.original_text.includes(code)` by parsing the finding's code with the same regex and comparing equal (today `ELD.PI.6.6` wrongly matches a `ELD.PI.6.66` line).

## 6. Steps
1. **Schema** (`packages/schema/src/api/outlines.ts`): in `ValidationReport.unit` add `finding: Finding.nullable().optional()` (optional so existing mocks/fixtures still parse; core always emits it). Run `npm -w @ls/schema run typecheck` (or the root typecheck, step 9).
2. **report.ts**: add `export interface EldLookup { strand_of(code: string): string | null }` and a 4th optional param `eld_lookup?: EldLookup`. Export nothing else new. Thread it into `report_row`. Add a module-level `const ELD_LINE = /^\W*(ELD\.P(?:I|II)\.\d+\.?\d*[a-z]?)\s*[–-]\s*(.+?)\s*$/;` (duplicate, do not import from normalize-codes: it is not exported and duplication is cheaper than a new seam) and a helper `parse_eld_line(text): {code, label} | null` that splits at newlines and tests each line.
3. In `report_row` ELD map: find the mismatch finding with `parse_eld_line(f.original_text)?.code === code`; set `sheet_label = parsed.label` (or `""`), `suggested_remap = mismatch.proposed_fix` (or null), `official_strand = eld_lookup?.strand_of(code) ?? ""`. Leave `verdict` and `choice` logic as is.
4. In `build_validation_report`, build `unit.finding`: `const unit_finding = findings.find(f => f.kind === "unit_conflict")` (the already-sorted non-ok list) → `report_finding(…, latest)` or `null`. Add key `finding` as the LAST key of the `unit` object (fixed field order keeps byte-identical reads). `counts` and gate untouched (they already count it).
5. **Service** (`outline-service.ts`): in `report()` do `const index = await this.standards.index();` and pass as 4th arg; do the same at the call in `record_choice` (reuse the index already fetched at ~173 if it is in scope, else fetch once; do not fetch twice in one path). Nothing else in the file.
6. **Web** (`report-model.ts`, `errors-section.tsx`): `errorItems` currently only sees findings inside `rows`. After the row loop, if `report.unit.finding` is present and not already seen, push `{ row: <see below>, finding: report.unit.finding, where: "Unit", name: "the unit" }` placed FIRST in the list (SCR-4 copy order "Unit" first). `ErrorItem.row` is required: make it `row: Row | null`, and fix the two uses (`errors-section.tsx` ~lines 90-125 and any `item.row.` access; grep `item.row` and `\.row\b` in the feature) to tolerate null, using `item.finding.finding_id` as the key. `errors-section.tsx` already renders the Unit sentence and `aria-label` "Confirm {unit.as_written} for the unit" and sends `confirm_unit` with `target_id: f.finding_id` — do not change that behaviour. Do not change row 30's duplicate "Focus" label (NL-94 remaining item, out of scope).
7. **Contract docs**: `interface.openapi.yaml` — in `ValidationReport.unit` add property `finding: { oneOf: [{ $ref: '#/components/schemas/Finding' }, { type: 'null' }], description: "The unit-conflict finding (kind unit_conflict), or null when the sheet and filenames agree; confirm it with CON-4 confirm_unit." }`, NOT added to `required` (same style as CHG-4). Update the example at ~line 265 (and any other `unit:` example) to show the finding (`finding_id` copy from that example's existing findings style; use `finding: null` where the example has no conflict). Check `Finding` is the schema name (`grep -n "^    Finding:" docs/contracts/interface.openapi.yaml`); if the name differs use the real one. Regenerate `cd apps/web && npm run api:types`. `INTERFACE.md` CON-3: extend the `unit` bullet with `finding` (the unit-conflict finding or empty) and the `eld` bullet with "(`sheet_label` is the label on the sheet, empty when the sheet line fitted; `official_strand` is the seeded CDE strand; `suggested_remap` is the stored proposal)". `CHANGES.md`: add the CHG-5 row (columns as the CHG-4 row: date 2026-10-25, CON-3, field, additive description, "orchestrator under Innocent's PD-32 standing authorization (2026-10-25)", sources updated list, waiting to reconcile "NL-94 (unmerged): unskip its two test.fixme; NL-57, NL-77 notes", status `reconciled`).
8. **Tests** (write with the code):
   - `packages/core/src/intake/report.test.ts` (existing counts test at line ~106 must stay green). Add, using the issued-sheet outline fixture already used there: `unit_conflict_finding_is_listed` (`report.unit.finding?.kind === "unit_conflict"`, `finding_id` equals the id of the outline's null-row finding, `proposed_fix === "U4"`, `choice.source === "default"`; after passing a confirmed choice for that id: `choice.source === "confirmed"`, `unit.confirmed === true`); `unit_finding_null_without_conflict` (WP-5/clean outline → `null`); `eld_fields_filled_from_stored_data` (a mismatch row: `sheet_label` equals the label text after the dash in the finding's `original_text`, `suggested_remap` equals the finding's `proposed_fix`, `official_strand` equals the stub lookup's value; a fitting code in the same row keeps `sheet_label ""`, `suggested_remap null`); `eld_code_prefix_does_not_cross_match` (`ELD.PI.6.6` vs a `ELD.PI.6.66` finding line); `eld_without_lookup_is_empty_strand` (3-arg call → `official_strand ""`); `report_is_byte_identical_twice` (JSON.stringify of two builds equal).
   - `apps/web/src/features/validation-report/report-model.test.ts`: `errorItems` puts the unit item first with `where "Unit"` when `report.unit.finding` is set and none in rows; no duplicate when present.
   - Service test: extend `apps/web/app/api/outline-versions/[outlineVersionId]/report/route.test.ts` with one case `report_lists_unit_conflict_and_strand` on the issued sheet (counts unchanged: 47/1/1/3/2/7; `unit.finding` non-null; at least one `eld` entry with non-empty `official_strand`).
9. **Docs**: devlog `docs/devlog/2026-10-25-chg-5.md` (Changed · Why · Checked · Remaining); area-map A4 and A14 rows get one sentence each.

## 7. Requirements table
| Requirement | Implementation | Verification |
|---|---|---|
| CON-3 guarantee: issued sheet counts 47/1/1/3/2/7 unchanged | counts untouched | `report.test.ts` existing test + new route case |
| CON-3 byte-identical reads | `finding` last key of `unit`; no new randomness | `report_is_byte_identical_twice` |
| SCR-4 "Confirm U4 for the unit" and unit sentence | step 4 + 6 | `report-model.test.ts` unit-first case; real-stack unfixme later (NL-94) |
| SCR-4 ELD side-by-side label and strand, re-map suggestion | step 3 | `eld_fields_filled_from_stored_data` |
| CON-4 `confirm_unit` targets the finding id | unchanged (`outline-choices.ts:54`) | existing choice tests stay green |
| Zod/OpenAPI/api-types agree | steps 1, 7 | `tests/contract/` suite below |

## 8. Checks
Iterate: `npx vitest run packages/core/src/intake/report.test.ts` ; `npx vitest run apps/web/src/features/validation-report` ; `npx vitest run "apps/web/app/api/outline-versions/[outlineVersionId]/report/route.test.ts"` (needs `scripts/test-db.sh up`; `down` after).
Before the final commit (affected only): the three above plus `npx vitest run tests/contract packages/core/src/intake apps/web/app/api/outline-versions apps/web/src/server/services` , `npm run eval:golden -- --suite intake` (golden must remain 100%; it calls the 3-arg form, so it should not change; if it fails because a projected `unit` object is compared whole, stop and report, do not edit `evals/**`), then lint, format and typecheck with the repo's root scripts (`npm run lint`, `npm run typecheck`; check `package.json` for exact names). Full suite not required (contract file plus one shared schema; contract tests cover it).
Stay green: all of `packages/core/src/intake/*.test.ts`, `apps/web/src/features/validation-report/*.test.ts`, `tests/contract/**`.

## 9. Do not
Do not invent labels for fitting codes, do not read the standards for a label, do not add a model call, do not change `counts`, `generate_allowed`, finding ids or the finding kind list, do not edit `normalize*.ts`, `evals/**` or NL-94's e2e, do not make `finding` required in OpenAPI, do not add an interface beyond `EldLookup`.

## 10. Risks and open items
- NL-94's branch is unmerged; its two `test.fixme` (unit button, ELD side-by-side) are unfixed here and are to be unskipped by NL-94's integrator after CHG-5 merges. Also there: PRD's "7 ELD mismatches" vs computed 16 findings / 9 codes (PD-36) is a separate ruling (S-10); this slice does not touch counts.
- Per-row ELD "fits" entries have no label because none is stored (NL-94 remaining item 3 is the same fact). Showing labels for fitting codes would need normalizer storage: a separate CHG, not this one.
- Collision: `report-model.ts`/`errors-section.tsx` were NL-57's; confirm no open branch edits them (NL-94 touched `eldItems`/ELD control in the same folder: expect a textual merge conflict in `report-model.ts`; keep both sides).
- `record_choice` returns `rows[0]` as `row` for the unit target (row_number null). Left as is; mention in devlog.

Readiness: **READY**
