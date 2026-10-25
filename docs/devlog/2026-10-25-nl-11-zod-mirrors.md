# NL-11 Zod mirrors of the OpenAPI components (2026-10-25)

- **Changed:** `packages/schema/src/api/*.ts` (12 files, 102 component mirrors plus `StoredMessage`, `ModeMessage`, `RefusedMessage`, `TransitionRequestInput`), `packages/schema/tests/contract/**` (oracle, 7 test files, type-level parity file); `yaml` 2.9.1 added to root devDependencies; schema tsconfig now includes `tests`.
- **Why:** one runtime validator per contract component, proven against the 63 spec examples and the generated types.
- **Checked:** schema tests, lint, typecheck (see commit). Parity negative check: flipping `User.synthetic` to a string fails `tsc`.
- **Remaining:** `ProseMirrorDoc.content` items use `z.custom<Record<string, never>>` to match the generator's type; runtime accepts any object.
