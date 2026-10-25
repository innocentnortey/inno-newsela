# NL-01 platform workspace (2026-10-25)

**Changed.** Added the npm workspace (14 `@ls/*` packages, one lockfile), root TypeScript/ESLint/Vitest configs, the boundaries and no-raw-HTML lint rules, `scripts/run-target.mjs` (unbuilt targets exit 2), `packages/config` (typed settings, `SecretStr`, `ConfigError`), `packages/obs` (JSON logger) and Postgres-only Compose files.

**Why.** Every later ticket builds inside this base; the lints and the redaction tests enforce DO-3 section 1 and OBS-7 from day one.

**Checked.** Lint, typecheck, full Vitest suite, clean `npm ci`, Compose `ports` checks, frozen-test hashes.

**Remaining.** Dockerfiles, `render.yaml`, composition roots and wiring stubs (NL-06/07/23). `xlsx` 0.18.5 pin needs the security reviewer's call.
