# Seam audit, 2026-10-26 (waves W0 to W9 merged, main 3e5d55a)

Run by `seam-audit-agent` (read-only; it cannot write files, so the orchestrator saved its report). Method: code reading plus
`npm run typecheck` (clean). **Not run:** unit tests, Playwright, the real stack. Paths 1, 2, 3 and 5 got a partial code read,
not a full walk; candidates/adopt, the export and coverage services, unit quality and the editor-to-collab edit path were
not traced in code (they have real-stack acceptance specs from their own tickets).

## Verdicts

| Path | Verdict |
|---|---|
| 1 Sign-in, import, validation choices, start run | CLEAN (generate gate enforced in `run-service.ts:start`) |
| 2 Run, worker, control, candidates | CLEAN (`CLAIM_SQL` claims only planning/running runs; job runner checks `is_cancelled`; candidate run kinds line up web/worker) |
| 3 Co-edit through approve | NOT CLEAN, non-blocking (web-to-collab command client matches the collab `/internal` routes; open S-18, S-29; Render collab URL) |
| 4 Export | CLEAN with a note (CHG-6 still open, S-39: downloaded file and OpenAPI schema can drift) |
| 5 Board, heartbeats, quality, coverage, prompts | NOT CLEAN, non-blocking (hard-coded board link; S-18) |
| 6 Container and wiring | CLEAN (15 service slots wired; 36 OpenAPI operations plus `/api/healthz` have handlers; env names in Compose and `render.yaml` exist in `settings.ts`) |

**Blocking seams for the Compose demo: none.**

## Findings, ranked

1. Medium (Render only): `render.yaml` passes no `NEXT_PUBLIC_COLLAB_URL` build arg to `ls-web` and `next.config.ts` has no `/collab` rewrite, so co-editing on Render would fail (`collab-url.ts:5`). The deploy prompt already flags it.
2. Medium: the nav "Unit board" link is hard-coded to `/units/g6-u4/board` (`apps/web/src/features/frame/nav.ts:18`), so it only opens the seeded unit.
3. Medium (S-18): `workspace-screen.tsx:69` sends the heartbeat `version_id` as `lv-${version_number}`, stored verbatim by `packages/db/src/repos/metrics.ts`, so `review_session` is keyed on a made-up id; the `Lesson` type has no `version_id`.
4. Medium (S-29): collab keeps the role captured at connect, so a demoted user keeps writing on an open socket (S-9 covers sign-out, revoke and expiry only).
5. Low: `apps/collab/src/main.ts` calls `void wire_collab_commands(...)`: a throw is an unhandled rejection.
6. Low: the collab commands pool (`wiring/commands.ts`) is never closed on drain.
7. Low: `apps/collab/src/deps.ts` keeps an unused `unbuilt("NL-36")` db stub.

## Other checks

- Open seam rows: none is a Compose-demo blocker (S-18, S-29, S-39, S-43, S-45, S-1..S-7 reviewed; the other ~50 were not triaged). S-6 (no unique index on the job key) remains open. S-33 and S-34 are being fixed in GEN-3.
- `docs/plans/seam-followups.md` housekeeping: S-8 is listed twice (`done` and `open`); S-30 and S-31 are reused for different items.
- CHG state: CHG-1..5 merged; CHG-6 open; no `reconcile: CHG-N` marker on merged code.
- Area map: 373 path tokens sampled by script; 51 did not resolve (checked: `wiring/collab.ts` stale name, `apps/web/package-lock.json` deleted); seven built files are unnamed in the map (`approve-service.ts`, `board-test-fakes.ts`, `export-fixtures.ts`, `metrics-test-fakes.ts`, `finalizer-doubles.ts`, `judge-client-factory.ts`, `lesson-docs.test-support.ts`); NL-140 reconciles this.
