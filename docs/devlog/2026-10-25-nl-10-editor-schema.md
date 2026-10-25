# NL-10 editor-schema (Phase B, Sonnet)

**Changed.** Added `packages/editor-schema/src/{schema,errors}.ts`: 18 nodes, 4 role marks, `SCHEMA_VERSION` 1, `EDITOR_SCHEMA`, `assert_known_nodes`, `SchemaUnknownError`; fixtures `all-nodes.json` and `reading-wp1.json`; five test files. `ordered_list.type` tightened to null or `A` (ticket names only `A`).
**Why.** The allow-list (R-11, R-58) is the single source for the editor, compile and store checks. **Checked.** eslint, prettier, tsc, 18 vitest tests green.
**Remaining.** AC-2 "22 nodes" read as 22+ node instances covering all 18 types. Callers (NL-12, NL-18..20) out of scope.
