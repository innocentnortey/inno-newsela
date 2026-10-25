# Handoff to Phase B (Sonnet) — Newsela Lesson Studio

Written 2026-10-25 by the Phase A session (Opus, VPS). Phase B builds every wave through delivery on Sonnet (PD-34).
Read this first, then `CLAUDE.md` → `.claude/README.md` → `PROJECT-CHECKLIST.md`. **Start at *Next action*.**

## Accepted designs

Everything below is accepted under Innocent's standing authorization (PD-32). **Innocent has not yet read** the spike
results, DO-1/DO-2 or the Stage 6 page; anything he raises reopens that item.

| What | Where | State |
|---|---|---|
| System design (DO-1), architecture (DO-2) | `docs/design/system-design.md`, `docs/design/architecture.md` | ready; Stage 6 page `docs/artifacts/2026-10-25-system-design.html` (check passes) |
| Code design (DO-3) and the code map | `docs/design/code-design.md` (areas A0–A21, 35 tables, one storage owner, composition roots + per-area wiring files; §7 addenda at the end) → `.claude/reference/area-map.md` | ready; Metz re-review **PASS** (`docs/design/reviews/2026-10-25-code-design-review.md`) |
| Component contracts (DO-4) | `docs/design/component-contracts.md` (Python-style stubs = language-neutral; build them as TypeScript interfaces / Zod schemas with the same names and fields) | ready; `signature_check.py` exit 0 |
| Eval plan (DO-5), observability (DO-6, WF-1…WF-46), metrics (DO-7, M-1…M-44) | `docs/design/eval-plan.md`, `observability.md`, `metrics-registry.md` | ready; `design_outputs.py --gate tickets` exit 0 |
| Readiness report | `docs/design/system-design-readiness.md` | READY |
| Spec dry run | `docs/design/spec-dry-run.md` | 29 gaps, all closed |
| Hard problems and spikes | `docs/design/hard-problems.md`; `docs/analysis/spikes/SP-1…SP-3` | no card open; see *Decisions* |
| Visual direction and tokens | D1 Clear Ledger; `docs/design/design.md`; look sheet `docs/artifacts/2026-10-25-d1-clear-ledger-look-sheet.html` | decided |

## Decisions

Standing (do not reopen): D1 Clear Ledger; capacity 500 users/day, a spike of 200 concurrent users, no 200-day
requirement (PD-33); zero-to-hero 2.0.0; VPS copy authoritative (PD-34); PD-32 standing authorization; Sonnet for
everything in Phase B.

Made in Phase A (each recorded at its source):

- **SP-1 (HP-1, PD-4, PD-13, PD-14):** one `LessonDraft` call + one repair per lesson. The API's schema-enforced output
  **rejects** the `LessonDraft` schema ("compiled grammar is too large"): embed the schema in the prompt and validate with
  Zod in code; the `UnitPlan` call keeps schema-enforced output. Model `claude-sonnet-5-5`, effort low, `max_tokens`
  32,000 (truncation retry 48,000), per-call timeout 240 s, concurrency cap **6**, per-run spend cap **$13.00**. Price
  used $2 / $10 per M tokens (checked 2026-10-25; re-check before quoting).
- **SP-2 (HP-4, HP-5):** Submit freeze = server-side read-only flip + a per-update guard (`WriteGuard.on_update`);
  refused updates come back as `refused` with `refused_from`; the editor drops refused local edits and tells the typist.
  The close-all-connections fallback is not used (CHG-1).
- **SP-3 (HP-2):** quote and page scans block everywhere (quote span ≥ 3 words); the name scan (capitalised-token
  heuristic + the `compromise` npm library) **blocks only in `cfu_item`s** and is advisory elsewhere.
- **SDQ-1…3 (DO-1):** checks run in the worker from `check_job`; the judge goes through OpenRouter; spend reservations also
  enforce the $75 build total.
- **DO-3 addenda (§7):** `hash_password` in `packages/core/src/auth/passwords.ts`; stored-lesson type is structural (no
  `editor-schema` import); one wiring file per area; e2e ownership (FW-4 owns `playwright.config.ts` + `e2e/gallery/**`).
- **Specs written by Sonnet for 131 of 147 tickets** (budget, PD-35), using Opus-written exemplars; first 16 by Opus.

## Contracts

- `docs/contracts/INTERFACE.md`: **CON-1…CON-24 all `agreed`** (UX and System reviews on every card).
- `docs/contracts/interface.openapi.yaml` v1.0.0 (36 operations, each `x-con`); `redocly lint` clean.
  Mock: `npx -y @stoplight/prism-cli@latest mock -p 4010 docs/contracts/interface.openapi.yaml`.
  Types: `npx -y openapi-typescript@latest docs/contracts/interface.openapi.yaml -o docs/contracts/generated/api-types.ts`.
  Known mock difference: Prism answers a malformed body with the operation's 422 example; the real backend returns 400
  `INVALID_REQUEST`.
- `docs/contracts/CHANGES.md`: CHG-1 (reconciled). Any change to an agreed card is a new `CHG-N`; work citing it is
  marked `reconcile: CHG-N` and waits; unrelated work continues.

## Ticket register

147 tickets in `docs/plans/tickets/` (`<ID>.json` + `<ID>.md`), published to GitLab project **2346**
(`innocentnortey/inno-newsela`, private) with labels `wave::N`, `kind::…`, `lane::…`, `slice::<area>`,
`risk::security`, `gate::human`, `cuttable`. **GitLab owns status**; the JSON `gitlab_iid` maps each ticket to its
issue. Board (generated): `docs/plans/tickets.md`. Slice plan with waves, collision maps and the parallelism audit:
`docs/plans/slice-plan.md`. Coverage audit (requirement × workflow → ticket AC): `docs/plans/coverage-audit.md`.

Split: 122 build-loop · 17 direct · 8 human; 4 foundation · 23 frontend · 64 backend · 56 integration (incl. 4 wave-0
non-implementation tickets); 29 `risk::security`. Waves W0–W12; widest W4 (38); critical path 13 tickets
(after the 7c re-run: NL-01 → NL-08 → NL-12 → NL-25 → NL-80 → NL-105 → NL-113 → NL-126 → NL-133 → NL-137 → NL-138 →
NL-141 → NL-143; NL-112, the full run, gates the §9 chain NL-120 → NL-128 → NL-134).

<!-- REGISTER:START -->
| Ticket | GitLab | Wave | Kind | Lane | Sec | Blocked by | Title |
|---|---|---|---|---|---|---|---|
| FW-1 | #1 | 0 | foundation | build-loop |  | — | FW: frontend scaffold, design tokens and typography |
| NL-01 | #2 | 0 | backend | build-loop | yes | — | platform: npm workspace — every package.json/tsconfig with pinned deps (incl. `compromi… |
| NL-02 | #3 | 0 | integration | human |  | PD-12, PD-29, SP-1, shared-provider-credentials rule | ops: provider keys confirmed in the shared env (Anthropic for real runs; OpenRouter for… |
| NL-03 | #4 | 0 | integration | human |  | demo-video skill §1, hiring-partner-framing rule | delivery: narration voice key in `.demo/.env` for the demo video |
| NL-04 | #5 | 0 | integration | direct |  | DO-1, DO-2, DO-3, DO-4, DO-5, DO-6, DO-7 | docs: `docs/ARCHITECTURE.md` draft from DO-1…DO-7 (live numbers left as `pending: NL-n`) |
| NL-05 | #6 | 0 | integration | direct |  | UX-1, UX-3a, UX-3b, slice-plan §7a | ux-verify: `docs/ux/05-verify/TRACEABILITY.md` skeleton, one row per SCR → US → CON → t… |
| FW-2 | #7 | 1 | foundation | build-loop |  | FW-1 | FW: basic accessible components |
| FW-3 | #8 | 1 | foundation | build-loop |  | FW-1 | FW: layout primitives |
| NL-06 | #9 | 1 | backend | build-loop |  | FW-1, NL-01 | platform: adopt `apps/web` into the workspace (one root lockfile; A0 takes over its pac… |
| NL-07 | #10 | 1 | backend | build-loop |  | NL-01 | platform: worker and collab entry points — `main.ts`, SIGTERM drain, dispatch to `/heal… |
| NL-08 | #11 | 1 | backend | build-loop | yes | NL-01 | storage: all DDL (`0000`–`0012`), append-only triggers, `audit_log_v`, pool, transactio… |
| NL-09 | #12 | 1 | backend | build-loop |  | NL-01 | schema: ids, outline, UnitPlan, LessonDraft (no `quote` block), stored Lesson (structur… |
| NL-10 | #13 | 1 | backend | build-loop |  | NL-01 | editor-schema: the one ProseMirror node/mark schema, `SCHEMA_VERSION`, `assert_known_no… |
| NL-11 | #14 | 1 | backend | build-loop |  | NL-01 | schema/api: Zod mirrors of every OpenAPI component and `ApiErrorCode`, contract-tested … |
| FW-4 | #15 | 2 | foundation | build-loop |  | FW-2, FW-3 | FW: component gallery with axe and visual checks |
| NL-12 | #16 | 2 | backend | build-loop |  | NL-08, NL-09 | storage: `ports.ts` (every DO-4 §3 port), Clock and IdGenerator, shared in-memory fakes… |
| NL-13 | #17 | 2 | backend | build-loop | yes | NL-06, NL-11 | auth: route wrapper — session resolve (own `SessionResolver` interface), Origin check, … |
| NL-14 | #18 | 2 | backend | build-loop | yes | NL-09 | prompts: locked layer and renderers (UnitPlan with schema-enforced output; draft and re… |
| NL-15 | #19 | 2 | backend | build-loop |  | NL-09 | intake: CDE standards index (seeded text, parent → listed leaves, ELD verdict table) |
| NL-16 | #20 | 2 | backend | build-loop | yes | NL-09 | intake: parse CSV/XLSX, normalize rows and cell kinds (incl. `unit_rule`, `safety_note`… |
| NL-17 | #21 | 2 | backend | build-loop |  | NL-09, NL-11 | intake: validation report and Generate gate (pure) |
| NL-18 | #22 | 2 | backend | build-loop |  | NL-09, NL-10 | compile: LessonDraft → allow-listed ProseMirror JSON (templates, minutes, addresses, te… |
| NL-19 | #23 | 2 | backend | build-loop |  | NL-09, NL-10 | ydoc: Lesson ↔ Y.Doc conversion, canonical hash, state vector, `covers` |
| NL-20 | #24 | 2 | backend | build-loop |  | NL-09, NL-10 | checks: kernel — registry with one shell per rule group, `CheckPolicy` (quote span ≥ 3,… |
| NL-21 | #25 | 2 | backend | build-loop | yes | NL-09 | review: lesson state machine `decide_transition` (roles, states, UXP-1/3/4/10) |
| NL-22 | #26 | 2 | backend | build-loop |  | NL-09 | generation: pipeline state, `route_after_checks`, circuit breaker (pure) |
| NL-23 | #27 | 2 | backend | build-loop | yes | NL-01, NL-06, NL-07, NL-08 | platform: `Dockerfile.web`, `Dockerfile.node`, full Compose stack (Postgres unpublished… |
| NL-24 | #28 | 3 | frontend | build-loop |  | FW-2, FW-3, FW-4, NL-06 | web-ui: generated API client, Prism mock harness, mock collaboration server, app frame … |
| NL-25 | #29 | 3 | backend | build-loop | yes | NL-12, NL-13 | auth: seeded-account sign-in, session resolve, sign-out, `middleware.ts`; fills auth wi… |
| NL-26 | #30 | 3 | backend | build-loop | yes | NL-12, NL-13, NL-16 | intake: upload and public-sheet import as numbered, hashed versions; Sheets fetcher; ou… |
| NL-27 | #31 | 3 | backend | build-loop |  | NL-12, NL-13 | runs: start a run (scope, pinned prompt, cap, idempotency, choices copy, jobs in one tx… |
| NL-28 | #32 | 3 | backend | build-loop |  | NL-12 | generation: job queue — fair-share `SKIP LOCKED` claim, lease, requeue expired, cancel,… |
| NL-29 | #33 | 3 | backend | build-loop |  | NL-12, NL-18, NL-20, NL-22 | generation: lesson/candidate job runner and nodes (reserve, draft, compile-check, one r… |
| NL-30 | #34 | 3 | backend | build-loop |  | NL-12, NL-22 | generation: claim loop (cap 6, lease renewal, expired-lease requeue at start) and run f… |
| NL-31 | #35 | 3 | backend | build-loop |  | NL-12, NL-14, NL-22 | generation: UnitPlan job, stored before any lesson claim |
| NL-32 | #36 | 3 | backend | build-loop | yes | NL-12, NL-14 | llm: Anthropic adapter (only SDK importer; schema-enforced mode for UnitPlan, plain + Z… |
| NL-33 | #37 | 3 | backend | build-loop | yes | NL-12 | llm: model-call recorder (row before send, raw output on arrival, retries, 240 s timeou… |
| NL-34 | #38 | 3 | backend | build-loop |  | NL-12, NL-13, NL-14 | prompts: prompt versions — list, current, v1 from the locked hash, no locked-layer writ… |
| NL-35 | #39 | 3 | backend | build-loop | yes | NL-12 | spend: reservation decision and atomic ledger (run cap, user-day cap, $75 build ceiling) |
| NL-36 | #40 | 3 | backend | build-loop | yes | NL-12, NL-19 | collab: lesson document store transaction (Y.Doc + derived JSON + hash + state vector +… |
| NL-37 | #41 | 3 | backend | build-loop |  | NL-12 | checks: coalesced check queue and issue repository keyed to content hash |
| NL-38 | #42 | 3 | backend | build-loop |  | NL-12, NL-20 | checks: check-context loader shared by worker, Submit freeze and Approve |
| NL-39 | #43 | 3 | backend | build-loop |  | NL-20 | checks: alignment (taught + checked; listed / narrowed / added; leaf only), safety (tip… |
| NL-40 | #44 | 3 | backend | build-loop |  | NL-20 | checks: grounding — quote span, page/chapter range, name scan (`compromise`; blocking i… |
| NL-41 | #45 | 3 | backend | build-loop |  | NL-20 | checks: arc continuity advisory rules (R-9) |
| NL-42 | #46 | 3 | backend | build-loop |  | NL-12 | review: lessons, versions, snapshots, review events, last editor, dependants, approved … |
| NL-43 | #47 | 3 | backend | build-loop |  | NL-12 | review: safety-flag, alignment-link and suggestion repositories |
| NL-44 | #48 | 3 | backend | build-loop |  | NL-10, NL-12, NL-13, NL-21 | review: lesson read (derived row or snapshot) and history |
| NL-45 | #49 | 3 | backend | build-loop |  | NL-12, NL-13 | review: issue list as of a hash (`pending`), resolutions, safety-flag clear, standard d… |
| NL-46 | #50 | 3 | backend | build-loop |  | NL-12, NL-13, NL-20 | review: fill a placeholder or excerpt slot through the collaboration server |
| NL-47 | #51 | 3 | backend | build-loop |  | NL-12, NL-13 | review: regenerate as candidate, read, adopt |
| NL-48 | #52 | 3 | backend | build-loop |  | NL-12, NL-13 | metrics: heartbeats, merged sessions across tabs, frozen first-approval metrics row, bo… |
| NL-49 | #53 | 3 | integration | build-loop |  | NL-12 | evals: evidence repository, eval runner, CLI, suite shells S1–S14, `load/` shells |
| NL-50 | #54 | 3 | backend | build-loop | yes | NL-12, NL-13, NL-14 | assist: request and decide an AI rewrite suggestion |
| NL-51 | #55 | 3 | backend | build-loop | yes | NL-09, NL-12, NL-13 | export: idempotent export of approved snapshots (dependants only when their sources are… |
| NL-52 | #56 | 3 | integration | direct |  | NL-23 | docs: README run and Compose instructions |
| NL-53 | #57 | 4 | backend | build-loop | yes | NL-20, NL-21, NL-27, NL-28, NL-35, NL-36, NL-37, NL-38, NL-42, NL-43, NL-44, NL-45, NL-46, NL-47, NL-48 | review: lesson transitions with every gate re-checked on the server (pin, four-eyes, ra… |
| NL-54 | #58 | 4 | backend | build-loop |  | NL-37, NL-42, NL-43, NL-48 | metrics: unit board and unit metrics from stored rows, aggregate only; fills metrics-ar… |
| NL-55 | #59 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-2 Units home |
| NL-56 | #60 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-3 Upload outline |
| NL-57 | #61 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-4 Validation report (cell text rendered as text, R-58) |
| NL-58 | #62 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-5 Start run dialog |
| NL-59 | #63 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-6 Generation progress (2 s poll, stale banner, run control) |
| NL-60 | #64 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-7 Unit plan |
| NL-61 | #65 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-8 Unit board (sort, filters, north-star tile) |
| NL-62 | #66 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-9 read view and evidence pane (issue jump-to-span, addresses, asserted-by, … |
| NL-63 | #67 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-9 live editor (y-prosemirror + provider, presence, stored ack, reconnect, d… |
| NL-64 | #68 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-9 workspace actions (standard confirm/remove + 6 s undo, start review, subm… |
| NL-65 | #69 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-10 Insert quote or excerpt |
| NL-66 | #70 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-11 Resolve or clear |
| NL-67 | #71 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-12 Candidate compare |
| NL-68 | #72 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-14 Approval review (checklist, pin, rating, stale 409) |
| NL-69 | #73 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-15 Send back or reopen |
| NL-70 | #74 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-16 History and provenance |
| NL-71 | #75 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-17 Run summary |
| NL-72 | #76 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-13 AI assist panel |
| NL-73 | #77 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-18 Coverage matrix |
| NL-74 | #78 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-19 Unit quality |
| NL-75 | #79 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-20 Export |
| NL-76 | #80 | 4 | frontend | build-loop |  | NL-24 | web-ui: SCR-21 Prompt guidance |
| NL-77 | #81 | 4 | backend | build-loop |  | NL-15, NL-17, NL-26 | intake: validation report read and intake choices (`default` vs confirmed by name) |
| NL-78 | #82 | 4 | backend | build-loop |  | NL-26, NL-27, NL-28, NL-33, NL-34, NL-35 | runs: progress, unit plan, control, summary; fills runs wiring |
| NL-79 | #83 | 4 | integration | build-loop | yes | NL-07, NL-14, NL-27, NL-28, NL-29, NL-30, NL-31, NL-32, NL-33, NL-34, NL-35, NL-36, NL-42, NL-43 | generation: worker wiring — real queue, adapters, recorder, spend, store; capture throu… |
| NL-80 | #84 | 4 | backend | build-loop | yes | NL-07, NL-21, NL-25, NL-36, NL-42 | collab: Hocuspocus server — socket auth from the app session, per-update write guard wi… |
| NL-81 | #85 | 4 | backend | build-loop |  | NL-07, NL-20, NL-26, NL-36, NL-37, NL-38, NL-42, NL-43 | checks: check job runner in its own worker lane (issues, alignment links, dependants re… |
| NL-82 | #86 | 4 | backend | build-loop | yes | NL-08, NL-15, NL-25, NL-34 | ops: seed CDE standards, prompt v1, one demo account per role |
| NL-83 | #87 | 4 | backend | build-loop | yes | NL-06, NL-07, NL-08, NL-49 | ops: health routes on web/worker/collab, process start events, backup script, sample-bu… |
| NL-84 | #88 | 4 | backend | build-loop |  | NL-15, NL-16, NL-17, NL-49 | evals: S1 intake golden and S7 safety-note cases |
| NL-85 | #89 | 4 | backend | build-loop |  | NL-20, NL-39, NL-40, NL-49 | evals: S2 check golden and S4 grounding plants |
| NL-86 | #90 | 4 | backend | build-loop |  | NL-11, NL-49 | evals: full-run driver over the OpenAPI (Prism-tested) and S9/S13 report builder from s… |
| NL-87 | #91 | 4 | backend | build-loop |  | NL-49 | evals: spike report importer (SP-1…SP-3) |
| NL-88 | #92 | 4 | backend | build-loop |  | NL-27, NL-34 | prompts: save a guidance version and try it on one lesson |
| NL-89 | #93 | 4 | backend | build-loop | yes | NL-12, NL-14, NL-33 | judge: OpenRouter adapter, judge job, verdict repository |
| NL-90 | #94 | 4 | integration | build-loop | yes | NL-24, NL-25 | integration: CON-1 sign-in end to end (SCR-1 on the real backend) |
| NL-91 | #95 | 5 | backend | build-loop |  | NL-43, NL-54 | coverage: coverage matrix query and route |
| NL-92 | #96 | 5 | backend | build-loop |  | NL-49, NL-53 | evals: seeded-error planting and report tool |
| NL-93 | #97 | 5 | integration | build-loop |  | NL-26, NL-55, NL-56, NL-78, NL-79, NL-90 | integration: CON-2 units list, upload and link import end to end, incl. SCR-2's latest … |
| NL-94 | #98 | 5 | integration | build-loop |  | NL-57, NL-77, NL-82, NL-90 | integration: CON-3/4 validation report and choices end to end |
| NL-95 | #99 | 5 | integration | build-loop |  | NL-34, NL-58, NL-78, NL-90 | integration: CON-5 start run and CON-24 prompt list end to end |
| NL-96 | #100 | 5 | integration | build-loop |  | NL-59, NL-60, NL-78, NL-79, NL-90 | integration: CON-6/7/8 progress, control and plan end to end on the stub worker |
| NL-97 | #101 | 5 | integration | build-loop |  | NL-71, NL-78, NL-79, NL-90 | integration: CON-21 run summary end to end |
| NL-98 | #102 | 5 | integration | build-loop |  | NL-54, NL-61, NL-90 | integration: CON-9/10 board and north-star tile end to end |
| NL-99 | #103 | 5 | integration | build-loop |  | NL-53, NL-54, NL-64, NL-68, NL-90 | integration: CON-20 heartbeats end to end and the S8 scripted 3-lesson review |
| NL-100 | #104 | 5 | integration | build-loop |  | NL-53, NL-62, NL-70, NL-90 | integration: CON-11/19 lesson read and history end to end |
| NL-101 | #105 | 5 | integration | build-loop | yes | NL-63, NL-80, NL-90 | integration: CON-12 co-editing end to end (two sessions, reload, unauthenticated refuse… |
| NL-102 | #106 | 5 | integration | build-loop | yes | NL-42, NL-51, NL-75, NL-90 | integration: CON-23 export end to end; fills export wiring |
| NL-103 | #107 | 5 | integration | build-loop |  | NL-76, NL-79, NL-88, NL-90 | integration: CON-24 save and one-lesson trial end to end |
| NL-104 | #108 | 5 | integration | build-loop |  | NL-54, NL-74, NL-90 | integration: CON-10 unit quality page end to end |
| NL-105 | #109 | 5 | backend | build-loop | yes | NL-26, NL-38, NL-43, NL-80 | collab: internal command routes (token guard, `apply_edit` tagged by a named person, `s… |
| NL-106 | #110 | 5 | backend | build-loop | yes | NL-20, NL-21, NL-38, NL-42, NL-80 | collab: Submit freeze — store at once, cover check, blocking checks on the stored row, … |
| NL-107 | #111 | 5 | integration | build-loop |  | NL-49, NL-79 | evals: S6 fault-injection script (kill, 429, truncation, cap) |
| NL-108 | #112 | 5 | integration | build-loop |  | NL-14, NL-79 | experiment: §9 kickoff page generated from code (flow, prompts with versions, failure t… |
| NL-109 | #113 | 5 | integration | build-loop |  | NL-02, NL-49, NL-79 | evals: S3 draft golden on the real model (WP-1…WP-3 × 3), `gate::paid` |
| NL-110 | #114 | 5 | integration | build-loop |  | NL-79, NL-89 | judge: advisory judge after store (own claim loop), `judge_no` issues, never blocks App… |
| NL-111 | #115 | 5 | backend | build-loop |  | NL-49, NL-89 | evals: judge calibration script |
| NL-112 | #116 | 5 | integration | direct |  | NL-02, NL-25, NL-26, NL-39, NL-40, NL-77, NL-78, NL-79, NL-81, NL-82, NL-86 | evals: S9 full run of the issued unit (*n* = 47) and its report, before recording; `gat… |
| NL-113 | #117 | 6 | integration | build-loop |  | NL-45, NL-46, NL-53, NL-62, NL-64, NL-65, NL-66, NL-81, NL-105 | integration: CON-13/14/15 issues, resolutions, standard decisions and slot fills end to… |
| NL-114 | #118 | 6 | integration | build-loop |  | NL-47, NL-53, NL-64, NL-67, NL-79, NL-105 | integration: CON-16 regenerate, compare and adopt end to end |
| NL-115 | #119 | 6 | integration | build-loop | yes | NL-53, NL-64, NL-68, NL-69, NL-99, NL-105, NL-106 | integration: CON-18 submit, approve by a second account on the pinned version, send bac… |
| NL-116 | #120 | 6 | integration | build-loop | yes | NL-32, NL-33, NL-35, NL-50, NL-72, NL-105 | integration: CON-17 AI assist end to end; fills assist wiring |
| NL-117 | #121 | 6 | integration | build-loop |  | NL-73, NL-91 | integration: CON-22 coverage matrix end to end |
| NL-118 | #122 | 6 | integration | build-loop |  | NL-49, NL-98, NL-99, NL-100 | capacity: HTTP load probe for the 200-user mix (R-57 as amended, PD-33) |
| NL-119 | #123 | 6 | integration | build-loop |  | NL-49, NL-101 | capacity: Yjs socket load script (R-56 as amended) |
| NL-120 | #124 | 6 | integration | direct |  | NL-108, NL-112 | experiment: error-analysis round — ~20 traces, first failure each, `FT-N` taxonomy, mod… |
| NL-121 | #125 | 6 | integration | build-loop | yes | NL-49, NL-112 | evals: held-out structural comparison, counts only, written outside tracked files |
| NL-122 | #126 | 6 | integration | human |  | NL-110, NL-112 | judge: Innocent labels ~30 (activity, standard) pairs |
| NL-123 | #127 | 7 | integration | human |  | NL-99, NL-112, NL-115 | ops: Innocent's measured review sessions (reviewer + approver accounts), two stopwatch … |
| NL-124 | #128 | 7 | integration | human |  | NL-92, NL-112, NL-115 | seeded errors: ~5 planted by Claude, reviewed by Innocent through the normal flow |
| NL-125 | #129 | 7 | integration | build-loop |  | NL-49, NL-101, NL-113, NL-115 | evals: S5 integrity e2e, 20 trials per assertion, 3 browser contexts |
| NL-126 | #130 | 7 | integration | direct |  | NL-90, NL-93, NL-94, NL-95, NL-96, NL-97, NL-98, NL-99, NL-100, NL-101, NL-113, NL-114, NL-115 | UX-5b: connected-app walkthrough, Lighthouse, `QA_REPORT.md`, every UX-5a row linked |
| NL-127 | #131 | 7 | integration | direct |  | NL-23, NL-113, NL-114, NL-115, NL-118 | capacity: 200-user spike on the VPS (2-min ramp, 15-min plateau, provider stubbed) and … |
| NL-128 | #132 | 7 | integration | build-loop |  | NL-109, NL-120 | experiment: XP-1 — one change against one `FT-N`, scored on the frozen set |
| NL-129 | #133 | 7 | integration | build-loop |  | NL-109, NL-120 | experiment: XP-2 (slot; closed unused if no second FT warrants a change) |
| NL-130 | #134 | 7 | integration | build-loop |  | NL-109, NL-120 | experiment: XP-3 (slot, as above) |
| NL-131 | #135 | 7 | integration | direct |  | NL-112, NL-120 | docs: demo decision inventory and angle-and-demo framing |
| NL-132 | #136 | 7 | integration | direct |  | NL-111, NL-122 | judge: calibration record (agreement, *n*, 10 held-back labels) |
| NL-133 | #137 | 8 | integration | human |  | NL-126 | UX-5b: final acceptance sign-off |
| NL-134 | #138 | 8 | integration | direct |  | NL-128, NL-129, NL-130 | evals: score the XPs on the frozen set; re-run the unit only if the prompt changed; fin… |
| NL-135 | #139 | 8 | integration | direct |  | NL-124 | evals: seeded-error report ("our reviewers") |
| NL-136 | #140 | 8 | integration | direct |  | NL-126, NL-131 | docs: demo script (two-layer order) and interview-prep table |
| NL-137 | #141 | 9 | integration | direct |  | NL-123, NL-125, NL-127, NL-133, NL-134 | release: pre-deploy full suite, clean Compose up from the committed config, start event… |
| NL-138 | #142 | 10 | integration | human |  | NL-03, NL-123, NL-133, NL-136, NL-137 | delivery: record the demo video (product under 5 min, then decisions) |
| NL-139 | #143 | 10 | integration | direct |  | NL-127, NL-134, NL-137 | docs: ARCHITECTURE final numbers, README final, `AI-USAGE.md` |
| NL-140 | #144 | 10 | integration | direct |  | NL-137 | context: ICM reconciliation (area map planned → actual, router, icm-progress, `check_co… |
| NL-141 | #145 | 11 | integration | direct |  | NL-138, NL-139, NL-140 | delivery: SUBMISSION walk — every row's evidence at its path |
| NL-142 | #146 | 11 | integration | direct |  | NL-138 | delivery: retro and lessons fed back (proposals for principles and zero-to-hero) |
| NL-143 | #147 | 12 | integration | human |  | NL-141 | delivery: submit on the Gauntlet portal |
<!-- REGISTER:END -->

## Execution order

The slice plan's *Execution order for Phase B* governs; in short:

1. Waves in order, pipelined: a ticket starts when its own blockers are merged and `ticket_readiness.py` says READY.
2. Critical path first inside a wave (W0 NL-01 · W1 NL-09, NL-08 · W2 NL-12 · W3 NL-29 … · W4 NL-79 … · W5 NL-112).
3. About 6 implementers running tests at once; planners/reviewers have their own allowance; `lane::direct` tickets run
   alongside; `lane::human` tickets get exact steps on the issue (Innocent) and block only what lists them.
4. Plan → implement → test → review; frozen tests first only for the 29 `risk::security` tickets; `security-privacy-agent`
   once per wave merge that contains one. Planners get a context pack (`.claude/rules/planning-context-packs.md`).
5. **Batch merges in tree order**, one merge agent on `main`; append each merged id to `docs/plans/merged.txt`
   (integration tickets' `execute` readiness reads it); close the GitLab issue with its evidence.
6. Seam audit per wave. Cut order PD-17 (#1 first) only if behind; tripwires: NL-109 (3-lesson trial) and NL-115.

## Budgets

- **Product model spend (PD-29): $75 total.** Used in Phase A: SP-1 ledger $3.55 (real provider spend ≈ $1.7). Per-run cap
  $13.00 (PD-14); each XP's S3 scoring ≈ $3.30. Record every live run's cost.
- **VPS session budgets (PD-35):** Phase B ≤ $200 per run, ≤ $600 total, ≤ 8 runs (`ops/vps-run/config.json`).
- Provider keys only via `/home/linuxuser/workspaces/bin/with-provider-env [--project-env .env] -- <command>`.

## Test instructions

- Affected tests only per role and merge (`.claude/rules/build-loop-test-scope.md`); the full suite only when a change
  reaches everything (NL-01, NL-06, NL-08, NL-11, NL-12, any lockfile change) and before NL-137 (pre-recording).
- Gates cheapest first: lint/format → typecheck → tests. Each ticket's WP-N (or PE-N) is one of its tests.
- Frontend: build against the Prism mock + generated types; UX-5a evidence per screen (TRACEABILITY row, axe 0 serious at
  1280/390 light+dark, visual check vs the D1 look sheet and `design.md`).
- Integration: real stack via NL-90's harness (`playwright.real.config.ts`); drive each listed WF entry point and assert
  its DO-6 records.
- Postgres: **this user has no Docker socket access**; `sudo -n docker …` works on this VPS (Docker Compose for the demo,
  PD-15 D). Don't touch other projects' Postgres containers (Cerbo on 55432). Spikes used PGlite in-process.
- Live-model tests run only through `with-provider-env`, inside the $75 ceiling.

## Known risks

- **Deadline:** due Tue 2026-10-27 03:00 CT; 147 tickets across 13 waves is a lot for ~36 h. Use the cut order and the
  tripwires; never trade the full run (NL-112) or honest numbers for a feature.
- **Specs by Sonnet:** 131 specs were written by Sonnet from exemplars. A planner who finds a spec gap marks it
  `needs-decision` / `blocked-on` instead of inventing, and fixes the ticket (PD-32 covers ordinary fixes).
- **Prompt tuned on spike rows:** SP-1 strengthened the length instruction on rows 8–9; the §9 golden suite must not use
  those rows for the length claim.
- **Drafts miss required blocks** (1–3 per lesson in SP-1); R-19's required-block check and the one repair must catch
  them — watch the repair rate.
- **Name scan false flags** outside check items (advisory there; 2–13 per lesson on real drafts).
- **GitLab SSH stalls** after key exchange on this VPS; push over HTTPS:
  `git -c credential.helper= -c credential.helper='!glab auth git-credential' push https://labs.gauntletai.com/innocentnortey/inno-newsela.git main`.
- **Human-only items still open:** Innocent reading the spike results and reviewing DO-1/DO-2/Stage 6 page; UX-5b
  walkthrough; the demo recording; portal submission (lane::human tickets).
- Spike worktrees remain at `/home/linuxuser/workspaces/.worktrees/newsela-SP-{1,2,3}` (branches `spike/SP-N`, never
  merged); archive per `references/spikes.md` step 6 when convenient.

## Next action

Build wave 0. First command (from the repo root):

```bash
for t in FW-1 NL-01; do python3 .claude/skills/zero-to-hero/scripts/ticket_readiness.py check docs/plans/tickets/$t.json --root .; done
```

Both print READY → dispatch `fanout-planner` (model `sonnet`) for **NL-01** (platform workspace, critical path) and
**FW-1** in one message, with context packs, then their implementers; dispatch the wave-0 direct tickets NL-04 and NL-05
to one general agent each alongside; post NL-02 and NL-03's steps for Innocent.
