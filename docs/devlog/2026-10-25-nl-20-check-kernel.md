# NL-20 check kernel (2026-10-25)

**Changed.** Added `packages/core/src/checks/` (types, policy, registry, gates), 28 rule files in 6 groups (4 structural bodies, 24 stubs), `derive_alignment` stub, tests and the WP-3 fixture; area map A6a updated.
**Why.** One registry so NL-39/40/41 fill only their own group's files. Decisions: section minutes tolerance 1 (module constant) so WP-1's 3-minute Look Back flags, lesson total keeps policy 50 ± 5; template table duplicated from NL-18 on purpose.
**Checked.** Affected tests, lint, typecheck (see commit).
**Remaining.** Contract gap: `schema_invalid` is in DO-4's CheckKind but not in the OpenAPI enum or the Zod mirror (needs a CHG). Rationale/personal-dictionary node shapes assumed from NL-18's design.
