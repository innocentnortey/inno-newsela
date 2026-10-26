# GEN-7 plan: reconcile CHG-6 (export file contract: `LessonExportFile` -> `ExportBundleFile`)

Wave dir `2026-10-26-w10`. Lane `lane::build-loop` (contract YAML, Zod, generated types, tests). **`risk::security`: no** (no authorization, input or role path changes; approved-only and hash guarantees are only asserted harder). **NEEDS-DECISION: no** (Innocent's PD-32 standing authorization covers the contract reconcile; the source of truth is fixed by the real-stack specs, section 3).
Commands run from `/home/linuxuser/workspaces/inno-newsela` ("root"). Implementer: Sonnet, one worktree, affected tests only. Own random `E2E_PORT` for the one real-stack run, kill only your own processes, never `npm ci` (`bash scripts/link-node-modules.sh` if modules are missing), test DB only `scripts/test-db.sh up` (127.0.0.1:55440), never `down`. Another agent runs a heavy load test: no loops, no repeated runs, each spec once. Disk ~6G: only your worktree; delete any `.next` or `test-results` you create. Never touch `docs/source/restricted` or provider keys. **No change to `export-service.ts`, `packages/db`, the route handlers or `lesson-export.schema.json`: the exported bytes and `payload_hash` must not move.**

## 1. What is wrong, in plain words

The download endpoint (`GET /api/exports/{exportId}/download`) returns the stored bundle. The service builds it as `ExportBundleFile` (`packages/schema/src/export.ts`): `{ export_version: 1, unit_id, generated_at, lessons: [{ lesson_id, version_id, content_hash, approved_by, approved_at, lesson }] }`, strict at both levels. The published `docs/contracts/lesson-export.schema.json` (emitted from that Zod schema by `packages/schema/scripts/emit-json-schemas.ts`) validates exactly that, with `additionalProperties: false`.

But the OpenAPI component `LessonExportFile`, its Zod mirror in `packages/schema/src/api/exports.ts`, and both generated `api-types.ts` describe a different file: `{ export_id, version_number, label, payload_hash, lessons: [{ lesson_id, content_hash, lesson }] }`. That file is never emitted. A client trusting the generated type would read `file.label` and get `undefined`; a file with those top-level keys would fail the published schema. Example: the Prism mock serves the OpenAPI example (with `label`), the real server serves `export_version`; the e2e stub in `apps/web/e2e/export/fixtures.ts` (lines ~97-115) copies the mock shape, so the web UI test passes against a file the server never sends.

## 2. Facts found on main (copied from code, 2026-10-26, HEAD c4f871c)

- `CHANGES.md` CHG-6 (row at line 44): status "open: the NL-102 implementer wrote the row only; the contract and type edits are the orchestrator's reconcile step". Lists the edit set: `interface.openapi.yaml` `LessonExportFile` + example, `packages/schema/src/api/exports.ts` `LessonExportFile`, both `api-types.ts`, INTERFACE.md CON-23 file description. "NL-75 downloads a blob and is unaffected."
- OpenAPI: `downloadExport` (line ~806-817) refs `#/components/schemas/LessonExportFile` with example `file`; schema at line ~2767; descriptions still say the JSON Schema is "planned". `listExports` / `createExport` are correct and untouched.
- INTERFACE.md CON-23 (line 1332+): "`downloadExport`: a JSON document in the `Lesson` export schema"; last Guarantee bullet says the export schema "will live at ... (planned; written with the export ticket, generated from the Zod `Lesson` schema)". Both stale: the file exists and is generated from `ExportBundleFile`. The label "Export (no live integration)" (PD-22) is a **screen** label (SCR-20, e2e `roles-and-label`), not a file field; the Guarantee bullet saying the export is "Labelled" should say the screen is labelled.
- `packages/schema/src/api/exports.ts` exports `LessonExportFile` (Zod, non-strict). `tests/contract/oracle.ts` builds `mirrors` from the exported Zod values of the `src/api/*` modules, keyed by export name; `examples.test.ts` parses every OpenAPI example with the mirror named by the response `$ref` (asserts **65** examples; the count must stay 65, so replace the example, do not add one). `api-types-parity.test-d.ts` lines 14 and 414-417 pin mutual assignability of `components["schemas"]["LessonExportFile"]` and the Zod type.
- `ExportBundleFile` lives in `packages/schema/src/export.ts` (not under `api/`); it reuses `StoredLesson` (`src/lesson.ts`: `lesson_id, schema_version, title, type, front_matter{standards[], minutes_total, vocabulary[]}, sections[], text_cards[]`; `text_cards` = `TextCardRecord` in `lesson-draft.ts`: `title, author|null, edition|null, chapter|null, pages|null, kind enum[off-platform-text, newsela-article, public-domain], content_available`). Note these differ from OpenAPI `TextCard` (`edition_or_isbn`, `rights_status`) and from the API `Lesson`: do **not** reuse OpenAPI `Lesson`/`TextCard` for the file; define new components.
- `ids.ts`: `UnitId` regex `^G\d{1,2}\.U\d{1,2}$`, `LessonId` regex `^G\d{1,2}\.U\d{1,2}\.(L\d{1,3}|FLEX-\d{1,2}[a-z]?)$`, `VersionId` = `lv_` + prefixed id. `Timestamp = z.iso.datetime({offset:true})`.
- Existing tests that already pin the file shape: `packages/schema/src/export.test.ts` (3 cases), `packages/schema/tests/contract/emitted-current.test.ts` (committed schema equals emitter; one valid bundle parses with `ExportBundleFile`), `apps/web/src/server/services/export-service.test.ts` + `.security.test.ts` (frozen by `docs/plans/frozen-tests/NL-51.manifest.json`; do not edit), real-stack `apps/web/e2e/integration/con-23/schema-and-hashes.spec.ts` (Ajv 2020 against the published schema, `strict:false, validateFormats:false`; hash identity). `helpers.ts` there has a local `Bundle` interface and `bundleHash`.
- Consumers of the type: `apps/web/src/features/export/use-exports.ts` `download()` calls `api.GET("/exports/{exportId}/download")` and writes `JSON.stringify(file, null, 2)` to a Blob; it reads **no** field, so no behaviour change; the generated type changes under it. `apps/web/e2e/export/fixtures.ts` stub body (above) must become a valid bundle. `apps/web/app/api/exports/http.ts` already types `download(): Promise<ExportBundleFile>`.
- Both `api-types.ts` copies are byte-identical today (`diff` empty). Generator: `openapi-typescript 7.13.0` (`apps/web/package.json` `api:types` writes `src/lib/api-types.ts`); the docs copy is the same output (system review used the `-o docs/contracts/generated/api-types.ts` form). Generated files are never hand-edited.
- S-39 in `docs/plans/seam-followups.md` line 58 lists three items: CHG-6 open; AC-5 idempotence assertion weak; Download clipped at 390px. This ticket closes the first two; the third stays open (presentation, SCR-20, not this slice).

## 3. Design (all decisions made)

**Single source of truth = `ExportBundleFile` in `packages/schema/src/export.ts`**, published as `docs/contracts/lesson-export.schema.json`. Why: it is what the service emits and stores (and hashes into `payload_hash`), what the CON-23 real-stack spec validates with Ajv, and what the NL-102 AC-5 and CON-23 Guarantees ("the file validates against the published JSON Schema") name. Changing the emitted bytes would change `payload_hash` for existing stored exports, which is forbidden. So the OpenAPI/Zod/types side moves, not the service.

Names: rename the OpenAPI component `LessonExportFile` to `ExportBundleFile` so the OpenAPI name equals the Zod name equals the emitted title; add two helper components `ExportedLessonRecord` (and, to describe the embedded lesson, `StoredLesson`, `StoredFrontMatter`, `StoredTextCard`). Nothing else in the repo refs `LessonExportFile` besides the files in section 4.

### 3.1 OpenAPI (`docs/contracts/interface.openapi.yaml`)

1. `downloadExport` 200: `$ref: '#/components/schemas/ExportBundleFile'`; description: "The export file: the bundle stored when the version was written, byte for byte. It validates against `docs/contracts/lesson-export.schema.json` (published; generated from the Zod `ExportBundleFile`)." Summary text "(validates against the published Lesson export schema)" stays.
2. Replace the example `file` with a valid bundle (must parse with Zod `ExportBundleFile` **and** Ajv against the published schema, section 5): `export_version: 1`, `unit_id: G6.U4`, `generated_at: 2026-10-25T12:00:00.000Z`, one lesson `G6.U4.L31` with `version_id: lv_01ARZ3NDEKTSV4RRFFQ69G5FAV`, `content_hash` = the sha256 of that stored lesson (compute with `content_hash()` from `@ls/schema/content-hash`; use the same minimal lesson as `emitted-current.test.ts`, id changed to `G6.U4.L31`, so the hash is real, not a placeholder), `approved_by: usr_...` any string, `approved_at: 2026-10-25T12:00:00.000Z`, `lesson` = that stored lesson.
3. Components: delete `LessonExportFile`; add (all `additionalProperties: false`, mirroring the strict Zod):
   - `ExportBundleFile`: required `[export_version, unit_id, generated_at, lessons]`; `export_version: { type: integer, const: 1 }` (match how `label` used `const` so openapi-typescript emits `1`); `unit_id: { type: string, pattern: '^G\d{1,2}\.U\d{1,2}$' }`; `generated_at: Timestamp`; `lessons: array of ExportedLessonRecord`.
   - `ExportedLessonRecord`: required `[lesson_id, version_id, content_hash, approved_by, approved_at, lesson]`; `lesson_id` with the LessonId pattern; `version_id` string pattern `^lv_`; `content_hash: Sha256`; `approved_by: string`; `approved_at: Timestamp`; `lesson: StoredLesson`.
   - `StoredLesson`: required `[lesson_id, schema_version, title, type, front_matter, sections, text_cards]`; `schema_version` integer minimum 1; `front_matter` = `StoredFrontMatter` (`standards: Standard[]` (reuse existing `Standard`, same enums as the Zod `Standard`: **verify** the OpenAPI `Standard` has the same fields and required list, else add `StoredStandard`), `minutes_total` integer, `vocabulary` string[]); `sections: Section[]` (existing OpenAPI `Section`, which already has `content: ProseMirrorDoc`); `text_cards: StoredTextCard[]` (new, fields as `TextCardRecord`).
   - Keep `ProseMirrorDoc`'s existing definition; if the OpenAPI doc node is looser/stricter than the Zod `ProseMirrorDoc`, the parity test (5.3) decides: match the Zod, because Zod is what parses the file.
   - Do not include format/pattern keywords that openapi-typescript would turn into different TS types; patterns do not affect generated types.
4. Run `npx redocly lint docs/contracts/interface.openapi.yaml` if available in `node_modules/.bin` (not `npx -y`: no network installs); report 0 errors. If not installed, skip and say so.

### 3.2 Zod mirror (`packages/schema/src/api/exports.ts`)

- Delete `LessonExportFile`. Add near the top `export { ExportBundleFile, ExportedLessonRecord } from "../export.ts";` and `export type { ... }` likewise, so `oracle.ts` `mirrors` (built from this module) resolves the OpenAPI schema name `ExportBundleFile` to the very schema the service uses. Update the file header comment ("Mirrors ... ExportBundleFile (export cards)").
- No change to `export.ts` (the strict schema stays the root).
- `oracle.ts` itself does not change. Check there is no name clash: `StoredLesson` and `Section` are exported from other modules; `mirrors` is keyed by export name across `src/api/*` only and `StoredLesson` is not in those, so adding OpenAPI `StoredLesson` produces no example (it has none) and no clash. If the parity test wants a Zod `StoredLesson` for the new OpenAPI components, import it from `../../src/lesson.ts` directly in the test, not through `api/`.

### 3.3 Generated types (both copies)

From `apps/web`: `npm run api:types` (writes `src/lib/api-types.ts`); then `cp apps/web/src/lib/api-types.ts docs/contracts/generated/api-types.ts`. Confirm `diff` of the two is empty and that the git diff of each is limited to the `LessonExportFile` hunk (removed) and the new components. If openapi-typescript is not runnable offline, hand-stop and report; do not hand-edit generated files.

### 3.4 Web client

- `apps/web/src/features/export/use-exports.ts`: no code change expected (reads no field). Run `npm run typecheck` to prove it. Update its comment only if it mentions the old shape (it does not).
- `apps/web/e2e/export/fixtures.ts` download stub (~line 97-115): replace the body with a valid bundle: `{ export_version: 1, unit_id: "G6.U4", generated_at: "2026-10-25T12:00:00.000Z", lessons: [] }` (the mock-project specs only check that a file is saved; confirm with `grep -rn "payload_hash\|label" apps/web/e2e/export/*.spec.ts` that no spec asserts the removed fields; if one does, update that assertion to the new field). Import `components["schemas"]["ExportBundleFile"]` as the stub's type so a future drift fails typecheck.

### 3.5 INTERFACE.md CON-23 (`docs/contracts/INTERFACE.md`)

- Fields: `downloadExport`: "a JSON document that is the `ExportBundleFile`: `export_version` (1), `unit_id`, `generated_at`, and `lessons` (`lesson_id`, `version_id`, `content_hash`, `approved_by`, `approved_at`, `lesson` = the stored lesson). Strict: no other keys. The `payload_hash` the list and create responses show is the sha256 of this document's canonical JSON; it is not a field inside it."
- Guarantees: change "Labelled 'Export (no live integration)' (PD-22)" to "The screen is labelled ... (PD-22); the file carries no label". Replace the "will live at ... (planned ...)" bullet with: "The export JSON Schema is published at `docs/contracts/lesson-export.schema.json`, generated from the Zod `ExportBundleFile` by `npm run schemas:emit` (CHG-6)." Add `reconcile: CHG-6` cleared (do not leave the marker).
- Do not change Status (still `agreed`); CON-23 Reviews list gets one line: "CHG-6 reconcile, GEN-7, 2026-10-26: file description matches the emitted bundle."

## 4. Files to touch (exact; anything else is out of scope)

| File | Change |
|---|---|
| `docs/contracts/interface.openapi.yaml` | 3.1 |
| `packages/schema/src/api/exports.ts` | 3.2 |
| `apps/web/src/lib/api-types.ts`, `docs/contracts/generated/api-types.ts` | 3.3 (regenerated) |
| `packages/schema/tests/contract/api-types-parity.test-d.ts` | replace the `LessonExportFile` import (line 14) and block (414-417) with `ExportBundleFile` (import from `../../src/api/exports.ts`); add `ExportedLessonRecord` pair; if the new OpenAPI `StoredLesson` is added to `components`, add a pair against Zod `StoredLesson` imported from `../../src/lesson.ts` |
| `packages/schema/tests/contract/export-file-contract.test.ts` | NEW, section 5.1 |
| `apps/web/e2e/export/fixtures.ts` | 3.4 |
| `apps/web/e2e/integration/con-23/schema-and-hashes.spec.ts` | section 5.2 (AC-5 witness) |
| `docs/contracts/INTERFACE.md` | 3.5 |
| `docs/contracts/CHANGES.md` | CHG-6 row, section 6 |
| `docs/plans/seam-followups.md` | S-39, section 6 |
| `docs/devlog/` new entry `2026-10-26-gen-7.md` | Changed / Why / Checked / Remaining; link from the dev-log README per the maintenance rule |
| `.claude/reference/routes/*` / area map | only if a row names `LessonExportFile` (`grep -rn LessonExportFile .claude docs --include=*.md`): historical fan-out plans and old devlogs keep it as history; **do not rewrite them** |

Not touched (frozen or out of scope): `export-service*.test.ts`, `docs/plans/frozen-tests/*`, `export-service.ts`, `packages/db/*`, `lesson-export.schema.json`, `emit-json-schemas.ts`, `oracle.ts`, `examples.test.ts` (count stays 65).

## 5. Tests: the drift guard

### 5.1 New contract test `packages/schema/tests/contract/export-file-contract.test.ts` (runs in the normal vitest project, no DB)

Three assertions on one fixture bundle built with `content_hash()` (copy the pattern in `emitted-current.test.ts`, 2 lessons):
1. **Zod:** `ExportBundleFile.safeParse(bundle).success === true`; `ExportBundleFile.safeParse({...bundle, label: "x"}).success === false`; same for an extra key inside a lesson record (strict).
2. **Published JSON Schema:** compile `docs/contracts/lesson-export.schema.json` with Ajv 2020 (same import and options as the real-stack spec: `ajv/dist/2020.js`, `{strict:false, validateFormats:false}`; check `ajv` is resolvable from `packages/schema` or the root `node_modules`; it is a dependency of the web e2e, so if it is not hoisted use `createRequire` from `apps/web` or add nothing: report instead of adding a dependency). The bundle validates; the same bundle plus a top-level `label` or `payload_hash` fails (this is exactly the old drift).
3. **OpenAPI:** `loadSpec()` from `./oracle.ts`; find `paths['/exports/{exportId}/download'].get.responses['200'].content['application/json']`; assert its `schema.$ref` ends with `/ExportBundleFile`; take its `examples.file.value` (and every other example under it) and assert it parses with Zod **and** validates with Ajv against the published schema. Also assert `components.schemas.LessonExportFile` is `undefined` (the old name cannot come back) and that the OpenAPI `ExportBundleFile.required` equals the published schema's top-level `required` as sets, and `ExportedLessonRecord.required` equals the schema's `lessons.items.required` (a field added on either side fails here).
4. **Emitted bytes:** build a bundle through `build_payload` is not available here (it is in apps/web), so cover "the service emits it" in 5.4 instead.

(`examples.test.ts` already parses the same example with the mirror; assertion 3 adds the JSON-Schema half it lacks.)

### 5.2 Fix the weak AC-5 idempotence assertion (`schema-and-hashes.spec.ts`, last lines)

Today: `file2.body.lessons` `toEqual` `file.body.lessons`. It compares the same stored object read twice, so it passes even if a second bundle were written. Replace with three independent witnesses:
- `const rowsBefore = (await exportRows(unit.unit_id)).length;` taken right after the first create; after the second create: `(await exportRows(unit.unit_id)).length` equals `rowsBefore` (1), and `again.status()` is 200.
- `expect(((await again.json()) as Created).same_as_previous).toBe(true)` and `.export_id` equals `c.export_id` and `version_number` equals `c.version_number`.
- `bundleHash(file2.body)` equals `computed` (hash of the first download), and `file2.text` equals `file.text` (the bytes, not the parsed objects); keep the existing `toEqual` only as a last, secondary line or drop it.
Also add to the spec: `expect(Object.keys(file.body).sort()).toEqual(["export_version","generated_at","lessons","unit_id"])` and each lesson's keys equal the six record keys (the `Bundle` interface in `helpers.ts` already declares exactly these). No new helper needed; do not edit `helpers.ts`.

### 5.3 Type parity (`tsc`)

`api-types-parity.test-d.ts` per section 4: `Gen<"ExportBundleFile">` and the Zod inference must be mutually assignable. If the Zod side infers `lesson` with `ProseMirrorNode` recursion and the OpenAPI side flattens differently, fix the OpenAPI component to match Zod (never edit the generated file, per the test header).

### 5.4 Existing tests that must still pass unchanged

`packages/schema` vitest (`export.test.ts`, `emitted-current.test.ts`, `examples.test.ts` 65 examples, `mutations`, `component-names`), `apps/web/src/server/services/export-service*.test.ts`, `apps/web/src/server/wiring/exports.test.ts`, `apps/web/app/api/units/[unitId]/exports/route*.test.ts`, `apps/web/tests/unit/features/export/copy.test.ts`. `component-names.test.ts` may pin the OpenAPI component list: if it fails because `LessonExportFile` left and new names arrived, update the **expected list in that test** (it is a contract list, not a frozen NL-51 file; check `grep -rn component-names docs/plans/frozen-tests`), and say so in the dev log.

## 6. Bookkeeping

- **CHANGES.md CHG-6** (line 44): in the last column replace "open: ..." with "reconciled 2026-10-26 (GEN-7): `interface.openapi.yaml` `LessonExportFile` removed, `ExportBundleFile` + `ExportedLessonRecord` + `StoredLesson` components added; Zod `api/exports.ts` re-exports `ExportBundleFile`; both `api-types.ts` regenerated and identical; INTERFACE.md CON-23 rewritten; drift guard `packages/schema/tests/contract/export-file-contract.test.ts` (Zod + published JSON Schema + OpenAPI example); real-stack `con-23 --grep schema-and-hashes` passing, bytes and hashes unchanged (hash line printed). NL-75 unaffected." Keep the cell's earlier text only if the table needs the original wording; remove any `reconcile: CHG-6` marker found by `grep -rn "reconcile: CHG-6" docs .claude apps packages`. Status column wording must say `reconciled`.
- **S-39** (seam-followups line 58): rewrite to "S-39 (NL-102): CHG-6 reconciled (GEN-7, 2026-10-26); AC-5 idempotence assertion strengthened (GEN-7); still open: Download clipped at 390px." Keep the id so references still resolve.
- Dev log + router: add the dev-log entry; the router row "Shared contracts" needs no edit. Run the context check the maintenance rule names (`python3 ~/.claude/skills/icm-project/scripts/check_context.py .`) and report no FAIL.

## 7. Verification (affected tests only; run each once, from root unless stated)

1. `npx vitest run packages/schema` (all schema tests incl. the new one). Expect: all pass, `examples.test.ts` still 65.
2. `npx vitest run apps/web/src/server/services/export-service apps/web/src/server/wiring/exports apps/web/app/api/units apps/web/app/api/exports apps/web/tests/unit/features/export` (adjust globs to the existing paths in section 5.4; the `[unitId]` bracket path must be quoted).
3. `npm run typecheck` (root; includes `api-types-parity.test-d.ts` and `use-exports.ts`).
4. `npm run lint` (root, `eslint .`). To save time you may pass the touched files only: `npx eslint <the changed .ts files>`; report which.
5. Real stack: `bash scripts/test-db.sh up`; then `cd apps/web && E2E_PORT=<random 20000-60000> perl -e 'alarm 500; exec @ARGV' npx playwright test -c playwright.real.config.ts e2e/integration/con-23 --grep schema-and-hashes`. Expect 1 passed; the `hashes: download=... list=... row=...` console line shows three equal values. Do not run the other con-23 specs (nothing else changed); do not run `down`. Delete `apps/web/.next` and `test-results` if created by you.
6. If `apps/web/e2e/export/fixtures.ts` changed: run the mock-project export spec once (`cd apps/web && E2E_PORT=<random> npx playwright test e2e/export`) only if it runs without the heavy build already warm; otherwise state "typecheck only" with the reason.
7. Evidence for the dev log and CHG-6 row: byte-stability proof: `git diff --stat` shows **no** file under `apps/web/src/server/`, `packages/db/`, `packages/core/`, or `docs/contracts/lesson-export.schema.json`; `npx tsx packages/schema/scripts/emit-json-schemas.ts` (writes to the committed place) leaves `git status` clean for `docs/contracts/` except the files you edited.

## 8. Risks and how they are closed

- **OpenAPI `ProseMirrorDoc`/`Standard` differ subtly from Zod:** the parity test (5.3) fails; align OpenAPI to Zod.
- **`ajv` not resolvable from `packages/schema`:** hoisted copy exists at root (used by the e2e); if not, import via `createRequire(new URL("../../../../apps/web/", import.meta.url))`; never add a dependency or run `npm ci`.
- **Prism mock now serves the new example:** the example is valid by 5.1, so the mock and the real server agree; no other consumer of the mock download exists (`grep` in section 3.4).
- **Generator drift between the two copies:** step 3.3 diff check.
- **Disk/CPU:** one real-stack spec only; remove build output.
