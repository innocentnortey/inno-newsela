# Slice plan (§7a, product-wide) — Newsela Lesson Studio

> **Status:** proposed (Claude, Opus, 2026-10-25; adoptable under PD-32) · **Procedure:** pinned
> `.claude/workflow/to-tickets/SKILL.md` v2.2.0 §0, §2, §2a–§2c, §5 · **Rules:** `ticket-lanes`,
> `build-loop-test-scope`, `code-design-solid-modularity` · **Project override:** every wave of the whole product is
> planned now, through delivery (PD-34: Phase A ends with complete ticketing).
> **Next passes:** 7b specs (one file per ticket in `docs/plans/tickets/`), 7c coverage audit, 7d GitLab publish.

## What this plan does, concretely

It turns the finished design (DO-1…DO-7, 24 agreed `CON-N` cards, 21 signed `SCR-N` specs) into **147 tickets in 13
waves**. Example of one behaviour becoming three tickets: *start a run* is `NL-27` (backend: `RunService.start`,
built against port doubles), `NL-58` (frontend: SCR-5 dialog against the Prism mock), and `NL-95` (integration:
the dialog against the real route, UX-5a rerun). `NL-27` and `NL-58` never wait for each other.

**Inputs this plan follows** (and does not copy where they were overtaken):

- DO-3 areas A0–A21 and table ownership, **but not DO-3 §4's wave column** (Metz review B1,
  `docs/design/reviews/2026-10-25-code-design-review.md`): order is derived from real calls here. Shared repositories
  (incl. `PgPromptRepo`), the lesson state machine and A6's dependencies land at least one wave before the ticket that
  wires the real object; same-wave consumers build against the DO-4 signature with doubles.
- Metz B2: **A0 owns every workspace `package.json`/`tsconfig`, the root lockfile, the boundaries lint config and one
  composition-root wiring file per area** (`NL-01`, `NL-06`, `NL-07`).
- SP-2 PASS, option A: Submit = server-side read-only flip + per-update write guard; the close-all-connections fallback
  is **dropped**; the editor drops refused local edits and tells the typist (CON-12 `refused` / `refused_from`).
- SP-1 PASS: one `LessonDraft` call + one repair (repair driven by required-block misses); the draft schema is embedded
  in the prompt and validated by Zod in code (API schema-enforced output rejected it); `UnitPlan` keeps schema-enforced
  output; concurrency cap **6**; per-run cap **$13.00**; per-call timeout **240 s**. These go straight into
  `NL-01` settings defaults; no "adopt spike values" ticket is needed.
- SP-3 PASS with scope: quote and page scans block everywhere (quote span ≥ 3 words); the name scan (heuristic +
  `compromise`) blocks only inside `cfu_item`s and is advisory elsewhere (`NL-20` policy, `NL-40` rules).

**Readiness today** (`ticket_readiness.py`): FW-1…FW-4 pass (foundation). Every backend and frontend ticket is
**NOT READY until the §6 gate line is ticked** (checked 2026-10-25 with the two probe tickets: "the §6 Design gate is
not ticked"); their CONs are all `agreed` and their SCRs all `signed`, so the gate is the only missing condition.
Integration tickets are plan-ready (each names what it joins). Non-implementation rows (`lane::direct`/`human` with no
dependency) carry kind `n/a`: `ticket_readiness.py` governs only the four implementation kinds; their readiness is
per `ticket-lanes` (skill §0, last row).

## Counts

| Split | Numbers |
|---|---|
| **Tickets** | **147** = FW-1…FW-4 + NL-01…NL-143 |
| **Lanes** | **122 build-loop, 17 direct, 8 human, 0 spike** (SP-1…SP-3 are finished spikes outside the set) |
| **Kinds** | **4 foundation, 23 frontend, 65 backend, 51 integration, 4 n/a** (NL-02…NL-05: wave-0 human/direct rows that join nothing) |
| **`risk::security`** | **30** (6 of them cuttable): NL-01, 08, 13, 14, 16, 21, 23, 25, 26, 32, 33, 35, 36, 50, 51, 53, 54, 79, 80, 82, 83, 89, 90, 101, 102, 105, 106, 115, 116, 121 |
| **Cuttable (PD-17)** | 24 tickets: #1 NL-119 · #2 NL-89, 110, 111, 121, 122, 132 · #3 NL-41 · #4 NL-73, 91, 117 · #5 NL-51, 75, 102 · #6 NL-74, 92, 104, 124, 135 · #7 NL-76, 88, 103 · #8 NL-50, 72, 116 |
| **Waves** | 13 (W0–W12) |
| **Critical path** | 13 tickets: NL-01 → NL-09 → NL-12 → NL-29 → NL-79 → NL-112 → NL-120 → NL-128 → NL-134 → NL-137 → NL-138 → NL-141 → NL-143 |
| **Widest wave** | W4, 38 tickets (22 of them frontend screens) |

How `risk::security` was decided (§2c, looking past obvious auth): settings holding secrets (NL-01); credential and
append-only tables (NL-08); route guard and sign-in (NL-13, 25, 90); untrusted sheet text that reaches a model prompt
(NL-16 normalize/flag, NL-14 delimiting) and an outbound sheet fetch (NL-26); model adapters and the recorder holding
or logging around provider keys (NL-32, 33, 79, 89); money (NL-35); approval integrity and who may move a lesson
(NL-21, 53, 106, 115); socket auth and the internal command token (NL-36 client, 80, 101, 105); per-person review
minutes never exposed (NL-54, GR-15); seeded passwords (NL-82); the backup file and health exposure (NL-83); deploy
and network config (NL-23); untrusted model text entering a document (NL-50, 116); export of approved-only content
(NL-51, 102); held-out data kept out of tracked files (NL-121). Display-only screens are not labelled; R-58 (no raw
HTML) is enforced by `NL-01`'s lint rule and checked as an AC on NL-57 and NL-62.

## Ticket list

**INT\*** = a non-implementation ticket (human or direct, wave 0) recorded with kind `integration` because `ticket_readiness.py` accepts only the four implementation kinds; its JSON `depends_on` names the artifacts or gates it rests on (e.g. the agreed design outputs), not tickets. Proposal for the next stage boundary: give the readiness script a kind for `lane::direct` / `lane::human` tickets.

Columns: **Kind** (BE backend, FE frontend, INT integration, FND foundation) · **Lane** (BL build-loop, D direct,
H human) · **CON/SCR/US** numbers only · **Anchor** = acceptance anchor (WP-N from `docs/data/worked-pairs.md`, PE-N
from the FW record, "SCR states" = the spec's state matrix as UX-5a evidence, "infra" = the DO-3/DO-4 section it
implements) · **Sec** = `risk::security` · **Cut** = PD-17 position or `—`.

**Every FE ticket's criteria include its UX-5a evidence** (its TRACEABILITY row, axe at 1280/390 light and dark,
visual check against the look sheet and `design.md`, behavioural checks against the CON mock); **every INT ticket
reruns them against the real backend** and drives the real entry point for its WF capture check.

### Wave 0 — 6 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FW-1 | FW: frontend scaffold, design tokens and typography | FND | BL | — | — | — | (P-1) | PE-1, PE-2, PE-3 | — | — | no | FW | — |
| NL-01 | platform: npm workspace — every package.json/tsconfig with pinned deps (incl. `compromise`, Yjs, Hocuspocus, SheetJS, SDK), root lockfile, boundaries lint (core imports no driver/SDK; no `dangerouslySetInnerHTML`), root scripts (DO-3 §9), typed settings with SP-1 defaults, JSON logger | BE | BL | — | 1–24 | — | — | infra: DO-3 §1, §7, §9 | WF-38 (fields) | M-29 | yes | A0 | — |
| NL-02 | ops: provider keys confirmed in the shared env (Anthropic for real runs; OpenRouter for the judge), `with-provider-env --check` evidence | INT* | H | — | 5, 16, 17 | — | 36 | — | WF-25, WF-23 | M-29 | — | A0 | — |
| NL-03 | delivery: narration voice key in `.demo/.env` for the demo video | INT* | H | — | — | — | — | — | — | — | — | delivery | — |
| NL-04 | docs: `docs/ARCHITECTURE.md` draft from DO-1…DO-7 (live numbers left as `pending: NL-n`) | INT* | D | — | — | — | — | — | — | — | — | delivery | — |
| NL-05 | ux-verify: `docs/ux/05-verify/TRACEABILITY.md` skeleton, one row per SCR → US → CON → tickets | INT* | D | — | all | 1–21 | 1–37 | — | — | — | — | A14 | — |

### Wave 1 — 8 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FW-2 | FW: basic accessible components | FND | BL | FW-1 | — | — | — | PE-4…PE-8 | — | — | no | FW | — |
| FW-3 | FW: layout primitives | FND | BL | FW-1 | — | — | — | PE-9 | — | — | no | FW | — |
| NL-06 | platform: adopt `apps/web` into the workspace (one root lockfile; A0 takes over its package.json/tsconfig); web composition root importing one wiring file per area (auth, intake, prompts, runs, metrics, review, assist, export) | BE | BL | FW-1, NL-01 | 1–24 | — | — | infra: DO-3 §8 | — | — | no | A0 | — |
| NL-07 | platform: worker and collab entry points — `main.ts`, SIGTERM drain, dispatch to `/healthz` and `/internal/*`, wiring shells (worker: generation, checks, judge; collab: server, commands), command-handler shells | BE | BL | NL-01 | 12, 13 | — | — | infra: DO-3 §8 | WF-38, WF-39 (shells) | — | no | A0 | — |
| NL-08 | storage: all DDL (`0000`–`0012`), append-only triggers, `audit_log_v`, pool, transactions, migration runner | BE | BL | NL-01 | 1–24 | — | 29 | infra: DO-3 §6 | WF-36 | — | yes | A1 | — |
| NL-09 | schema: ids, outline, UnitPlan, LessonDraft (no `quote` block), stored Lesson (structural ProseMirror JSON type), export bundle, JSON Schema emitter | BE | BL | NL-01 | 2, 3, 8, 11, 23 | — | 13 | WP-1, WP-5 | — | M-31 | no | A2 | — |
| NL-10 | editor-schema: the one ProseMirror node/mark schema, `SCHEMA_VERSION`, `assert_known_nodes` | BE | BL | NL-01 | 11, 12 | — | 13 | WP-1 | — | M-36 | no | A2 | — |
| NL-11 | schema/api: Zod mirrors of every OpenAPI component and `ApiErrorCode`, contract-tested against `interface.openapi.yaml` | BE | BL | NL-01 | 1–24 | — | — | infra: OpenAPI 1.0.0 | — | — | no | A2 | — |

### Wave 2 — 13 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FW-4 | FW: component gallery with axe and visual checks | FND | BL | FW-2, FW-3 | — | — | — | PE-10, PE-11 | — | — | no | FW | — |
| NL-12 | storage: `ports.ts` (every DO-4 §3 port), Clock and IdGenerator, shared in-memory fakes of cross-area ports, `PgAuditLog` | BE | BL | NL-08, NL-09 | 1–24 | — | 29 | infra: DO-4 §3 | WF-1…20 (audit rows) | — | no | A1 | — |
| NL-13 | auth: route wrapper — session resolve (own `SessionResolver` interface), Origin check, role guard, request id, Zod parse, pool wait `SERVICE_BUSY`, refusal envelope, latency log line | BE | BL | NL-06, NL-11 | 1–24 | — | 37 | infra: INTERFACE shared guarantees | WF-1…20 (request_id) | M-22 | yes | A3 | — |
| NL-14 | prompts: locked layer and renderers (UnitPlan with schema-enforced output; draft and repair with the schema embedded; assist; judge), outline text as delimited data | BE | BL | NL-09 | 5, 16, 17 | — | 6 | WP-2, SYN-1 | WF-21, WF-22 | M-7, M-31 | yes | A7 | — |
| NL-15 | intake: CDE standards index (seeded text, parent → listed leaves, ELD verdict table) | BE | BL | NL-09 | 3 | — | 5 | WP-1, WP-5 | — | M-40 | no | A4 | — |
| NL-16 | intake: parse CSV/XLSX, normalize rows and cell kinds (incl. `unit_rule`, `safety_note`), flag instruction-shaped text, compute lesson links | BE | BL | NL-09 | 2, 3 | — | 3, 4 | WP-5, WP-4 | — | M-39, M-40 | yes | A4 | — |
| NL-17 | intake: validation report and Generate gate (pure) | BE | BL | NL-09 | 3, 4, 5 | — | 3 | WP-5 | — | M-40 | no | A4 | — |
| NL-18 | compile: LessonDraft → allow-listed ProseMirror JSON (templates, minutes, addresses, teacher-only tip from confirmed safety notes) | BE | BL | NL-09, NL-10 | 11 | — | 13, 14 | WP-1, WP-3, WP-4 | — | M-31 | no | A5 | — |
| NL-19 | ydoc: Lesson ↔ Y.Doc conversion, canonical hash, state vector, `covers` | BE | BL | NL-09, NL-10 | 12, 18 | — | 25 | WP-1 | — | M-36 | no | A5 | — |
| NL-20 | checks: kernel — registry with one shell per rule group, `CheckPolicy` (quote span ≥ 3, name scan blocking in `cfu_item` only, reviewer quote ≤ 12), Submit/Approve gates, structural rules (schema, sections, minutes, ELD callouts, CFU keys, heading order, table headers) | BE | BL | NL-09, NL-10 | 13, 18 | — | 16 | WP-3 | — | M-5, M-30 | no | A6 | — |
| NL-21 | review: lesson state machine `decide_transition` (roles, states, UXP-1/3/4/10) | BE | BL | NL-09 | 18, 12 | — | 24, 25, 28 | WP-1 | — | M-37 | yes | A12 | — |
| NL-22 | generation: pipeline state, `route_after_checks`, circuit breaker (pure) | BE | BL | NL-09 | 6, 7 | — | 8 | WP-1 | — | M-15, M-44 | no | A9 | — |
| NL-23 | platform: `Dockerfile.web`, `Dockerfile.node`, full Compose stack (Postgres unpublished, internal token), committed `render.yaml` (PD-15 D) | BE | BL | NL-01, NL-06, NL-07 | 1–24 | — | — | infra: DO-3 §1 | WF-38 | — | yes | A0 | — |

### Wave 3 — 29 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NL-24 | web-ui: generated API client, Prism mock harness, mock collaboration server, app frame (nav, session redirect, can't-load and stale conventions), dialog and editor shells; SCR-1 sign in | FE | BL | FW-2, FW-3, FW-4, NL-06 | 1 (+all for the client) | 1 | 37 | SCR-1 states | WF-1 (client) | — | no | A14 | — |
| NL-25 | auth: seeded-account sign-in, session resolve, sign-out, `middleware.ts`; fills auth wiring | BE | BL | NL-12, NL-13 | 1 | — | 37 | CON-1 refusals | WF-1 | — | yes | A3 | — |
| NL-26 | intake: upload and public-sheet import as numbered, hashed versions; Sheets fetcher; outline/standard repos; fills intake wiring | BE | BL | NL-12, NL-13, NL-16 | 2 | — | 1, 2 | WP-5; issued XLSX twice → same hash | WF-2 | M-40 | yes | A4 | — |
| NL-27 | runs: start a run (scope, pinned prompt, cap, idempotency, choices copy, jobs in one tx), run repo, run state machine | BE | BL | NL-12, NL-13 | 5 | — | 6 | WP-1…WP-3 (3-row scope) | WF-4 | M-17 | no | A10 | — |
| NL-28 | generation: job queue — fair-share `SKIP LOCKED` claim, lease, requeue expired, cancel, retry failed, one candidate per lesson | BE | BL | NL-12 | 5, 6, 7, 16 | — | 8 | infra: HP-7 | WF-22, WF-6 | M-25, M-44 | no | A9 | — |
| NL-29 | generation: lesson/candidate job runner and nodes (reserve, draft, compile-check, one repair on required-block misses, truncation retry, store, settle, fail; safety flags at v1) | BE | BL | NL-12, NL-18, NL-20, NL-22 | 6, 16 | — | 7 | WP-1, WP-2, WP-4 | WF-22 | M-5, M-15, M-16, M-31 | no | A9 | — |
| NL-30 | generation: claim loop (cap 6, lease renewal, expired-lease requeue at start) and run finalizer (terminal, `partial`, `paused`, completeness query) | BE | BL | NL-12, NL-22 | 6, 7 | — | 8 | infra: HP-7 | WF-22, WF-6 | M-15, M-17, M-44 | no | A9 | — |
| NL-31 | generation: UnitPlan job, stored before any lesson claim | BE | BL | NL-12, NL-14, NL-22 | 8 | — | 9 | WP-1 | WF-21 | M-15 | no | A9 | — |
| NL-32 | llm: Anthropic adapter (only SDK importer; schema-enforced mode for UnitPlan, plain + Zod for drafts), stub provider, price table | BE | BL | NL-12 | 5, 16, 17 | — | — | WP-1 (stub fixture) | WF-22 | M-11, M-28 | yes | A7 | — |
| NL-33 | llm: model-call recorder (row before send, raw output on arrival, retries, 240 s timeout, lost calls) and `model_call` log | BE | BL | NL-12 | 21 | — | 32 | infra: R-48 | WF-22 | M-15, M-16, M-17, M-28 | yes | A7 | — |
| NL-34 | prompts: prompt versions — list, current, v1 from the locked hash, no locked-layer write path; fills prompts wiring | BE | BL | NL-12, NL-13, NL-14 | 24 | — | 10 | infra: R-38 | WF-4 (pin) | M-5 | no | A16 | — |
| NL-35 | spend: reservation decision and atomic ledger (run cap, user-day cap, $75 build ceiling) | BE | BL | NL-12 | 5, 16, 17 | — | 8 | infra: PD-14, PD-29 | WF-22, WF-28 | M-17, M-29 | yes | A8 | — |
| NL-36 | collab: lesson document store transaction (Y.Doc + derived JSON + hash + state vector + `check_job`), v1 seeding, web-side `HttpCollabCommandClient` | BE | BL | NL-12, NL-19 | 11, 12, 14, 15, 16, 18 | — | 15 | WP-1 | WF-9 | M-27, M-36 | yes | A11 | — |
| NL-37 | checks: coalesced check queue and issue repository keyed to content hash | BE | BL | NL-12 | 13 | — | 16 | infra | WF-10 | M-26 | no | A6 | — |
| NL-38 | checks: check-context loader shared by worker, Submit freeze and Approve | BE | BL | NL-12, NL-20 | 13, 18 | — | 12 | WP-1 | WF-10, WF-15 | — | no | A6 | — |
| NL-39 | checks: alignment (taught + checked; listed / narrowed / added; leaf only), safety (tip present, no 6-word leak, disclosure prompts), cross-lesson link, pending suggestion, open flag | BE | BL | NL-20 | 13 | — | 12, 19, 20 | WP-1, WP-4 | WF-10 | M-6, M-38, M-41 | no | A6 | — |
| NL-40 | checks: grounding — quote span, page/chapter range, name scan (`compromise`; blocking in CFU items, advisory elsewhere), `source_ref`, reviewer quote length, `to-clear` rights | BE | BL | NL-20 | 13, 15 | — | 17, 18 | WP-1, WP-2, WP-3 | WF-10 | M-7, M-32, M-33 | no | A6 | — |
| NL-41 | checks: arc continuity advisory rules (R-9) | BE | BL | NL-20 | 13 | — | 12 | seeded L6–L8 repeat | WF-10 | M-5 | no | A6 | #3 |
| NL-42 | review: lessons, versions, snapshots, review events, last editor, dependants, board rows, approved snapshots | BE | BL | NL-12 | 9, 11, 18, 23 | — | 29 | infra | WF-15 | — | no | A12 | — |
| NL-43 | review: safety-flag, alignment-link and suggestion repositories | BE | BL | NL-12 | 13, 14, 17, 22 | — | 19, 20 | infra | WF-11 | M-41 | no | A12 | — |
| NL-44 | review: lesson read (derived row or snapshot) and history | BE | BL | NL-10, NL-12, NL-13 | 11, 19 | — | 13, 14, 29 | WP-1 | WF-8 | M-18 | no | A12 | — |
| NL-45 | review: issue list as of a hash (`pending`), resolutions, safety-flag clear, standard decisions with undo | BE | BL | NL-12, NL-13 | 13, 14 | — | 16, 19, 20, 21 | WP-4 | WF-11 | M-2, M-6, M-41 | no | A12 | — |
| NL-46 | review: fill a placeholder or excerpt slot through the collaboration server | BE | BL | NL-12, NL-13, NL-20 | 15 | — | 17, 18 | WP-1, WP-2 | WF-12 | M-7 | no | A12 | — |
| NL-47 | review: regenerate as candidate, read, adopt | BE | BL | NL-12, NL-13 | 16 | — | 22 | WP-1 | WF-13 | M-11 | no | A12 | — |
| NL-48 | metrics: heartbeats, merged sessions across tabs, frozen first-approval metrics row (pure + repo + services) | BE | BL | NL-12, NL-13 | 20 | — | 15, 30 | WP-1, WP-3, WP-4 (scripted review) | WF-16 | M-1, M-3, M-12, M-43 | no | A13 | — |
| NL-49 | evals: evidence repository, eval runner, CLI, suite shells S1–S14, `load/` shells | BE | BL | NL-12 | 21 | — | 36 | infra: DO-5 | WF-24 | M-30 | no | A20 | — |
| NL-50 | assist: request and decide an AI rewrite suggestion | BE | BL | NL-12, NL-13, NL-14 | 17 | — | 23 | WP-1 | WF-14 | M-10 | yes | A15 | #8 |
| NL-51 | export: idempotent export of approved snapshots (dependants only when their sources are approved) | BE | BL | NL-09, NL-12, NL-13 | 23 | — | 35 | WP-1 | WF-19 | — | yes | A17 | #5 |
| NL-52 | docs: README run and Compose instructions | INT | D | NL-23 | — | — | — | — | — | — | — | delivery | — |

### Wave 4 — 38 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NL-53 | review: lesson transitions with every gate re-checked on the server (pin, four-eyes, rating, dependency order, Submit/unfreeze via collab); fills review-area wiring | BE | BL | NL-20, 21, 27, 28, 35, 36, 37, 38, 42, 43, 44, 45, 46, 47, 48 | 18 | — | 24–28, 31 | WP-1, WP-4 | WF-15 | M-1, 3, 6, 9, 11–14, 35, 37 | yes | A12 | — |
| NL-54 | metrics: unit board and unit metrics from stored rows, aggregate only; fills metrics-area wiring | BE | BL | NL-37, 42, 43, 48 | 9, 10, 20 | — | 11, 12, 30 | WP-1 | WF-7 | M-1, M-3, M-20 | yes | A13 | — |
| NL-55 | web-ui: SCR-2 Units home | FE | BL | NL-24 | 2, 6 | 2 | 1 | SCR states | — | — | no | A14 | — |
| NL-56 | web-ui: SCR-3 Upload outline | FE | BL | NL-24 | 2 | 3 | 1, 2 | SCR states | — | — | no | A14 | — |
| NL-57 | web-ui: SCR-4 Validation report (cell text rendered as text, R-58) | FE | BL | NL-24 | 3, 4, 5 | 4 | 3, 4, 5 | WP-5 | — | — | no | A14 | — |
| NL-58 | web-ui: SCR-5 Start run dialog | FE | BL | NL-24 | 5, 24 | 5 | 6 | WP-1…3 scope | — | — | no | A14 | — |
| NL-59 | web-ui: SCR-6 Generation progress (2 s poll, stale banner, run control) | FE | BL | NL-24 | 6, 7 | 6 | 7, 8 | SCR states | — | — | no | A14 | — |
| NL-60 | web-ui: SCR-7 Unit plan | FE | BL | NL-24 | 8 | 7 | 9 | WP-1 | — | — | no | A14 | — |
| NL-61 | web-ui: SCR-8 Unit board (sort, filters, north-star tile) | FE | BL | NL-24 | 9, 10 | 8 | 11, 12, 30 | SCR states | — | — | no | A14 | — |
| NL-62 | web-ui: SCR-9 read view and evidence pane (issue jump-to-span, addresses, asserted-by, R-58) | FE | BL | NL-24 | 11, 13 | 9 | 13, 14, 16 | WP-1 | — | — | no | A14 | — |
| NL-63 | web-ui: SCR-9 live editor (y-prosemirror + provider, presence, stored ack, reconnect, drops refused local edits and tells the typist) | FE | BL | NL-24 | 12 | 9 | 15 | WP-1 | — | — | no | A14 | — |
| NL-64 | web-ui: SCR-9 workspace actions (standard confirm/remove + 6 s undo, start review, submit with reasons, withdraw, regenerate entry, heartbeat sender) | FE | BL | NL-24 | 14, 16, 18, 20 | 9 | 15, 19, 22, 24 | SCR states | — | — | no | A14 | — |
| NL-65 | web-ui: SCR-10 Insert quote or excerpt | FE | BL | NL-24 | 15 | 10 | 17, 18 | WP-1, WP-2 | — | — | no | A14 | — |
| NL-66 | web-ui: SCR-11 Resolve or clear | FE | BL | NL-24 | 14 | 11 | 20, 21 | WP-4 | — | — | no | A14 | — |
| NL-67 | web-ui: SCR-12 Candidate compare | FE | BL | NL-24 | 16 | 12 | 22 | SCR states | — | — | no | A14 | — |
| NL-68 | web-ui: SCR-14 Approval review (checklist, pin, rating, stale 409) | FE | BL | NL-24 | 11, 13, 18, 20 | 14 | 25, 26, 27, 28, 31 | WP-1 | — | — | no | A14 | — |
| NL-69 | web-ui: SCR-15 Send back or reopen | FE | BL | NL-24 | 18 | 15 | 26, 28 | SCR states | — | — | no | A14 | — |
| NL-70 | web-ui: SCR-16 History and provenance | FE | BL | NL-24 | 19 | 16 | 29 | SCR states | — | — | no | A14 | — |
| NL-71 | web-ui: SCR-17 Run summary | FE | BL | NL-24 | 21 | 17 | 32, 36 | SCR states | — | — | no | A14 | — |
| NL-72 | web-ui: SCR-13 AI assist panel | FE | BL | NL-24 | 17 | 13 | 23 | SCR states | — | — | no | A14 | #8 |
| NL-73 | web-ui: SCR-18 Coverage matrix | FE | BL | NL-24 | 22 | 18 | 33 | SCR states | — | — | no | A14 | #4 |
| NL-74 | web-ui: SCR-19 Unit quality | FE | BL | NL-24 | 10 | 19 | 34, 36 | SCR states | — | — | no | A14 | #6 |
| NL-75 | web-ui: SCR-20 Export | FE | BL | NL-24 | 23 | 20 | 35, 28 | SCR states | — | — | no | A14 | #5 |
| NL-76 | web-ui: SCR-21 Prompt guidance | FE | BL | NL-24 | 24, 5 | 21 | 10 | SCR states | — | — | no | A14 | #7 |
| NL-77 | intake: validation report read and intake choices (`default` vs confirmed by name) | BE | BL | NL-15, NL-17, NL-26 | 3, 4 | — | 3, 4, 5 | WP-5; FE-4 counts on the issued sheet | WF-3 | M-13, M-40 | no | A4 | — |
| NL-78 | runs: progress, unit plan, control, summary; fills runs wiring | BE | BL | NL-26, 27, 28, 33, 34, 35 | 6, 7, 8, 21 | — | 7, 8, 9, 32 | WP-1 | WF-5, WF-6, WF-17 | M-15, 16, 17, 25 | no | A10 | — |
| NL-79 | generation: worker wiring — real queue, adapters, recorder, spend, store; capture through the real claim loop on the stub | INT | BL | NL-07, 14, 27–36, 42, 43 | 5, 6, 8 | — | 7, 8 | WP-1, WP-2 | WF-21, WF-22 | M-15, 16, 17, 28 | yes | A9 | — |
| NL-80 | collab: Hocuspocus server — socket auth from the app session, per-update write guard with `refused`/`refused_from`, debounced persistence, `stored`/`mode` acks; fills collab server wiring | BE | BL | NL-07, 21, 25, 36, 42 | 12 | — | 15 | WP-1 | WF-9 | M-19, M-24, M-27 | yes | A11 | — |
| NL-81 | checks: check job runner in its own worker lane (issues, alignment links, dependants re-queued); fills checks wiring | BE | BL | NL-07, 20, 26, 36, 37, 38, 42, 43 | 13 | — | 16 | WP-1 | WF-10 | M-7, M-26 | no | A6 | — |
| NL-82 | ops: seed CDE standards, prompt v1, one demo account per role | BE | BL | NL-08, 15, 25, 34 | 1, 3 | — | 37 | infra: R-4 counts | WF-37 | — | yes | A21 | — |
| NL-83 | ops: health routes on web/worker/collab, process start events, backup script, sample-builder event | BE | BL | NL-06, 07, 08, 49 | 1 (ops) | — | — | infra | WF-35, 38, 39, 40 | — | yes | A21 | — |
| NL-84 | evals: S1 intake golden and S7 safety-note cases | BE | BL | NL-15, 16, 17, 49 | 2, 3 | — | 3, 36 | WP-5, WP-4 | WF-24 | M-30, 38, 39, 40 | no | A20 | — |
| NL-85 | evals: S2 check golden and S4 grounding plants | BE | BL | NL-20, 39, 40, 49 | 13 | — | 36 | WP-1…WP-4 | WF-24 | M-30, 32, 33 | no | A20 | — |
| NL-86 | evals: full-run driver over the OpenAPI (Prism-tested) and S9/S13 report builder from stored rows | BE | BL | NL-11, NL-49 | 2, 3, 4, 5, 21 | — | 36 | WP-1…WP-3 | WF-25 | M-5, 6, 7, 11, 15, 16, 17, 31, 35 | no | A20 | — |
| NL-87 | evals: spike report importer (SP-1…SP-3) | BE | BL | NL-49 | 21 | — | — | infra | WF-32, 33, 34 | M-11, 16, 19 | no | A20 | — |
| NL-88 | prompts: save a guidance version and try it on one lesson | BE | BL | NL-27, NL-34 | 24, 5 | — | 10 | WP-1 (row 8 trial) | WF-20 | M-5 | no | A16 | #7 |
| NL-89 | judge: OpenRouter adapter, judge job, verdict repository | BE | BL | NL-12, 14, 33 | 13 | — | — | WP-1 | WF-23 | M-6, M-34 | yes | A19 | #2 |
| NL-90 | integration: CON-1 sign-in end to end (SCR-1 on the real backend) | INT | BL | NL-24, NL-25 | 1 | 1 | 37 | CON-1 refusals | WF-1 | — | yes | A3+A14 | — |

### Wave 5 — 22 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NL-91 | coverage: coverage matrix query and route | BE | BL | NL-43, NL-54 | 22 | — | 33 | WP-1 (hand count, 3 lessons) | WF-18 | M-14 | no | A18 | #4 |
| NL-92 | evals: seeded-error planting and report tool | BE | BL | NL-49, NL-53 | 18 | — | 34 | — | WF-26 | M-4 | no | A20 | #6 |
| NL-93 | integration: CON-2 units list, upload and link import end to end, incl. SCR-2's latest run state | INT | BL | NL-26, 55, 56, 78, 79 | 2, 6 | 2, 3 | 1, 2 | WP-5 | WF-2 | M-40 | no | A4+A14 | — |
| NL-94 | integration: CON-3/4 validation report and choices end to end | INT | BL | NL-57, 77, 82 | 3, 4 | 4 | 3, 4, 5 | WP-5 | WF-3 | M-13, M-40 | no | A4+A14 | — |
| NL-95 | integration: CON-5 start run and CON-24 prompt list end to end | INT | BL | NL-34, 58, 78 | 5, 24 | 5 | 6 | WP-1…3 | WF-4 | M-17 | no | A10+A14 | — |
| NL-96 | integration: CON-6/7/8 progress, control and plan end to end on the stub worker | INT | BL | NL-59, 60, 78, 79 | 6, 7, 8 | 6, 7 | 7, 8, 9 | WP-1 | WF-5, 6, 21 | M-15, M-25 | no | A10+A14 | — |
| NL-97 | integration: CON-21 run summary end to end | INT | BL | NL-71, 78, 79 | 21 | 17 | 32 | — | WF-17 | M-15, 16, 17 | no | A10+A14 | — |
| NL-98 | integration: CON-9/10 board and north-star tile end to end | INT | BL | NL-54, NL-61 | 9, 10 | 8 | 11, 12, 30 | WP-1 | WF-7 | M-1, 3, 20 | no | A13+A14 | — |
| NL-99 | integration: CON-20 heartbeats end to end and the S8 scripted 3-lesson review | INT | BL | NL-54, 64, 68 | 20 | 9, 14 | 15, 30 | WP-1, WP-3, WP-4 | WF-16 | M-1, M-43 | no | A13+A14 | — |
| NL-100 | integration: CON-11/19 lesson read and history end to end | INT | BL | NL-53, 62, 70 | 11, 19 | 9, 16 | 13, 14, 29 | WP-1 | WF-8 | M-18 | no | A12+A14 | — |
| NL-101 | integration: CON-12 co-editing end to end (two sessions, reload, unauthenticated refused, refused after lock) | INT | BL | NL-63, NL-80 | 12 | 9 | 15 | WP-1 | WF-9 | M-19, M-24 | yes | A11+A14 | — |
| NL-102 | integration: CON-23 export end to end; fills export wiring | INT | BL | NL-42, 51, 75 | 23 | 20 | 35 | WP-1 | WF-19 | — | yes | A17+A14 | #5 |
| NL-103 | integration: CON-24 save and one-lesson trial end to end | INT | BL | NL-76, 79, 88 | 24, 5 | 21 | 10 | WP-1 | WF-20 | M-5 | no | A16+A14 | #7 |
| NL-104 | integration: CON-10 unit quality page end to end | INT | BL | NL-54, NL-74 | 10 | 19 | 34, 36 | — | WF-7 | M-1…M-20 tiles | no | A13+A14 | #6 |
| NL-105 | collab: internal command routes (token guard, `apply_edit` tagged by a named person, `set_mode`); fills collab commands wiring | BE | BL | NL-26, 38, 43, 80 | 14, 15, 16, 17, 18 | — | 19, 22 | WP-1 | WF-11, 12, 13 | M-8 | yes | A11 | — |
| NL-106 | collab: Submit freeze — store at once, cover check, blocking checks on the stored row, snapshot + state + transition in one tx, server-side read-only flip (SP-2 A) | BE | BL | NL-20, 21, 38, 42, 80 | 18, 12 | — | 24 | WP-1 | WF-15, WF-9 | M-36, M-37 | yes | A11 | — |
| NL-107 | evals: S6 fault-injection script (kill, 429, truncation, cap) | INT | BL | NL-49, NL-79 | 5, 6, 7 | — | 8 | — | WF-28 | M-15, 17, 44 | no | A20 | — |
| NL-108 | experiment: §9 kickoff page generated from code (flow, prompts with versions, failure types); registers its WF row | INT | BL | NL-14, NL-79 | — | — | — | — | new WF-41 | — | no | A20 | — |
| NL-109 | evals: S3 draft golden on the real model (WP-1…WP-3 × 3), `gate::paid` | INT | BL | NL-02, NL-79 | 5 | — | 36 | WP-1, WP-2, WP-3 | WF-24 | M-30, M-31 | no | A20 | — |
| NL-110 | judge: advisory judge after store (own claim loop), `judge_no` issues, never blocks Approve; fills judge wiring | INT | BL | NL-79, NL-89 | 13 | — | — | WP-1 | WF-23 | M-6 | no | A19 | #2 |
| NL-111 | evals: judge calibration script | BE | BL | NL-49, NL-89 | 13 | — | — | — | WF-31 | M-34 | no | A20 | #2 |
| NL-112 | evals: S9 full run of the issued unit (*n* = 47) and its report, before recording; `gate::paid` | INT | D | NL-02, 25, 26, 39, 40, 77, 78, 79, 81, 82, 86 | 2–6, 21 | — | 36 | WP-1…WP-4 | WF-25 | M-5, 6, 7, 11, 15, 16, 17, 31 | — | A20 | — |

### Wave 6 — 10 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NL-113 | integration: CON-13/14/15 issues, resolutions, standard decisions and slot fills end to end | INT | BL | NL-45, 46, 53, 62, 64, 65, 66, 81, 105 | 13, 14, 15 | 9, 10, 11 | 16–21 | WP-1, WP-4 | WF-10, 11, 12 | M-2, 6, 7, 26 | no | A12+A14 | — |
| NL-114 | integration: CON-16 regenerate, compare and adopt end to end | INT | BL | NL-47, 53, 64, 67, 79, 105 | 16 | 9, 12 | 22 | WP-1 | WF-13 | M-11 | no | A12+A14 | — |
| NL-115 | integration: CON-18 submit, approve by a second account on the pinned version, send back, reopen | INT | BL | NL-53, 64, 68, 69, 99, 105, 106 | 18 | 9, 14, 15 | 24–28, 31 | WP-1, WP-4 | WF-15 | M-3, 9, 35, 37 | yes | A12+A14 | — |
| NL-116 | integration: CON-17 AI assist end to end; fills assist wiring | INT | BL | NL-32, 33, 35, 50, 72, 105 | 17 | 13 | 23 | WP-1 | WF-14 | M-10 | yes | A15+A14 | #8 |
| NL-117 | integration: CON-22 coverage matrix end to end | INT | BL | NL-73, NL-91 | 22 | 18 | 33 | WP-1 | WF-18 | M-14 | no | A18+A14 | #4 |
| NL-118 | capacity: HTTP load probe for the 200-user mix (R-57 as amended, PD-33) | INT | BL | NL-49, 98, 100 | 9, 11, 20 | — | 36 | — | WF-29 | M-18, 20, 21, 22 | no | A20 | — |
| NL-119 | capacity: Yjs socket load script (R-56 as amended) | INT | BL | NL-49, NL-101 | 12 | — | 36 | — | WF-30 | M-19 | no | A20 | #1 |
| NL-120 | experiment: error-analysis round — ~20 traces, first failure each, `FT-N` taxonomy, models × failures; `gate::human` (Innocent ✓, PD-32 fallback) | INT | D | NL-108, NL-112 | — | — | — | full-run traces | WF-25 (reads) | M-5, M-31 | — | §9 | — |
| NL-121 | evals: held-out structural comparison, counts only, written outside tracked files | INT | BL | NL-49, NL-112 | — | — | 36 | — | WF-27 | M-42 | yes | A20 | #2 |
| NL-122 | judge: Innocent labels ~30 (activity, standard) pairs | INT | H | NL-110, NL-112 | 13 | — | — | — | WF-31 | M-34 | — | A19 | #2 |

### Wave 7 — 10 tickets

| ID | Title | Kind | Lane | Depends on | CON | SCR | US | Anchor | WF | M | Sec | Area | Cut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NL-123 | ops: Innocent's measured review sessions (reviewer + approver accounts), two stopwatch reviews, approver ratings on the demo lessons | INT | H | NL-99, 112, 115 | 18, 20 | 9, 14 | 25, 30, 31 | WP-1…WP-3 | WF-15, 16 | M-1, 3, 35, 43 | — | A13 | — |
| NL-124 | seeded errors: ~5 planted by Claude, reviewed by Innocent through the normal flow | INT | H | NL-92, 112, 115 | 18 | 14 | 34 | — | WF-26 | M-4 | — | A20 | #6 |
| NL-125 | evals: S5 integrity e2e, 20 trials per assertion, 3 browser contexts | INT | BL | NL-101, 113, 115 | 12, 18 | 9, 14 | 24, 25 | WP-1 | WF-9, WF-15 | M-36, M-37 | no | A20 | — |
| NL-126 | UX-5b: connected-app walkthrough, Lighthouse, `QA_REPORT.md`, every UX-5a row linked | INT | D | NL-90, 93–101, 113, 114, 115 | all core | 1–12, 14–17 | core | — | — | — | — | A14 | — |
| NL-127 | capacity: 200-user spike on the VPS (2-min ramp, 15-min plateau, provider stubbed) and load report | INT | D | NL-23, 113, 114, 115, 118 | 9, 11, 12, 20 | — | 36 | — | WF-29 (+WF-30 if NL-119 landed) | M-18…M-23 | — | A20 | — |
| NL-128 | experiment: XP-1 — one change against one `FT-N`, scored on the frozen set | INT | BL | NL-120 | per FT | — | — | frozen set | WF-24/25 | M-5, M-31 | no | §9 | — |
| NL-129 | experiment: XP-2 (slot; closed unused if no second FT warrants a change) | INT | BL | NL-120 | per FT | — | — | frozen set | WF-24/25 | M-5, M-31 | no | §9 | — |
| NL-130 | experiment: XP-3 (slot, as above) | INT | BL | NL-120 | per FT | — | — | frozen set | WF-24/25 | M-5, M-31 | no | §9 | — |
| NL-131 | docs: demo decision inventory and angle-and-demo framing | INT | D | NL-112, NL-120 | — | — | — | — | — | — | — | delivery | — |
| NL-132 | judge: calibration record (agreement, *n*, 10 held-back labels) | INT | D | NL-111, NL-122 | 13 | — | — | — | WF-31 | M-34 | — | A20 | #2 |

### Waves 8–12 — 11 tickets

| ID | Title | Kind | Lane | Wave | Depends on | WF | M | Cut |
|---|---|---|---|---|---|---|---|---|
| NL-133 | UX-5b: final acceptance sign-off | INT | H | 8 | NL-126 | — | — | — |
| NL-134 | evals: score the XPs on the frozen set; re-run the unit only if the prompt changed; final full-run report (`gate::paid`) | INT | D | 8 | NL-128, 129, 130 | WF-25 | M-5, 11, 15–17, 31 | — |
| NL-135 | evals: seeded-error report ("our reviewers") | INT | D | 8 | NL-124 | WF-26 | M-4 | #6 |
| NL-136 | docs: demo script (two-layer order) and interview-prep table | INT | D | 8 | NL-126, NL-131 | — | — | — |
| NL-137 | release: pre-deploy full suite, clean Compose up from the committed config, start events present, one `pg_dump` (PD-30) | INT | D | 9 | NL-123, 125, 127, 133, 134 | WF-38, WF-40 | — | — |
| NL-138 | delivery: record the demo video (product under 5 min, then decisions) | INT | H | 10 | NL-03, 123, 133, 136, 137 | — | — | — |
| NL-139 | docs: ARCHITECTURE final numbers, README final, `AI-USAGE.md` | INT | D | 10 | NL-127, 134, 137 | — | — | — |
| NL-140 | context: ICM reconciliation (area map planned → actual, router, icm-progress, `check_context.py` clean) | INT | D | 10 | NL-137 | — | — | — |
| NL-141 | delivery: SUBMISSION walk — every row's evidence at its path | INT | D | 11 | NL-138, 139, 140 | — | — | — |
| NL-142 | delivery: retro and lessons fed back (proposals for principles and zero-to-hero) | INT | D | 11 | NL-138 | — | — | — |
| NL-143 | delivery: submit on the Gauntlet portal | INT | H | 12 | NL-141 | — | — | — |

Wave sizes: W8 4, W9 1, W10 3, W11 2, W12 1.

## Coverage at a glance (the 7c audit proves it row by row)

| Obligation | Where it lands |
|---|---|
| Every agreed CON served (backend) | 1 NL-25 · 2 NL-26 · 3–4 NL-77 · 5 NL-27 · 6–8, 21 NL-78 (8 written by NL-31) · 9–10 NL-54 · 11, 19 NL-44 · 12 NL-80 (+NL-36) · 13 NL-45 (+NL-81) · 14 NL-45 (+NL-105) · 15 NL-46 · 16 NL-47 · 17 NL-50 · 18 NL-53 (+NL-106) · 20 NL-48 · 22 NL-91 · 23 NL-51 · 24 NL-34 (list) + NL-88 (save) |
| Every signed SCR built (frontend, Prism mock + generated types, no backend edge) | SCR-1 NL-24 · 2 NL-55 · 3 NL-56 · 4 NL-57 · 5 NL-58 · 6 NL-59 · 7 NL-60 · 8 NL-61 · 9 NL-62/63/64 · 10 NL-65 · 11 NL-66 · 12 NL-67 · 13 NL-72 · 14 NL-68 · 15 NL-69 · 16 NL-70 · 17 NL-71 · 18 NL-73 · 19 NL-74 · 20 NL-75 · 21 NL-76 |
| Integration per CON (one FE + one BE, same agreed CON) | 1 NL-90 · 2 NL-93 · 3–4 NL-94 · 5, 24-list NL-95 · 6–8 NL-96 · 21 NL-97 · 9–10 NL-98 · 20 NL-99 · 11, 19 NL-100 · 12 NL-101 · 13–15 NL-113 · 16 NL-114 · 18 NL-115 · 17 NL-116 · 22 NL-117 · 10 (quality) NL-104 · 23 NL-102 · 24-save NL-103 |
| UX-5a / UX-5b | UX-5a: an AC on every FE ticket, rerun in its INT ticket · UX-5b: NL-126 (walkthrough, Lighthouse, QA_REPORT) → NL-133 (Innocent's sign-off) |
| §9 experiments | NL-108 kickoff → NL-120 error analysis (FT-N) → NL-128…130 XP slots → NL-134 scoring/rerun · R-51 golden: NL-84, 85, 109 + full run NL-112 · R-52: NL-92, 124, 135 · R-53: NL-121 · judge calibration: NL-111, 122, 132 |
| Capacity (PD-33) | R-57 HTTP probe NL-118 → 200-user run NL-127 · R-56 Yjs script NL-119 (cut #1; if cut, the docs say Yjs latency was not measured) |
| §10 delivery | ARCHITECTURE NL-04 → NL-139 · README NL-52 → NL-139 · decision inventory NL-131 · demo script + interview prep NL-136 · video NL-138 (human) · SUBMISSION walk NL-141 · retro NL-142 · ICM reconciliation NL-140 · Compose + `render.yaml` NL-23 · pre-deploy full suite NL-137 · portal NL-143 |
| Every WF-n has a ticket | WF-1 25/90 · 2 26/93 · 3 77/94 · 4 27/95 · 5 78/96 · 6 78/30 · 7 54/98 · 8 44/100 · 9 80/101 · 10 81 · 11 45/113 · 12 46/113 · 13 47/114 · 14 50/116 · 15 53/115 · 16 48/99 · 17 78/97 · 18 91/117 · 19 51/102 · 20 88/103 · 21 31/79 · 22 29/79 · 23 110 · 24 49/84/85/109 · 25 86/112 · 26 92 · 27 121 · 28 107 · 29 118/127 · 30 119 · 31 111/132 · 32–34 87 · 35 83 · 36 08 · 37 82 · 38 83/23 · 39 83 · 40 83/137 · new WF-41 108 |
| Not ticketed (by design) | Trace browser (R-48 part, cut #6; no SCR or CON); Stretch rows R-7, 10, 13, 18, 24, 30, 32, 36, 43 (R-59 is partly covered by UX-5a axe); Roadmap rows; UX-4 (optional, never a dependency) |

## Parallelism audit (§2a)

**Edges removed, and why:**

1. **Frontend ↔ backend.** No FE ticket waits for a backend ticket; all 23 build against the Prism mock and generated
   types. The joins are 18 CON integration tickets.
2. **NL-10 → NL-09.** The stored `Lesson` types its sections as structural ProseMirror JSON; the node allow-list is
   enforced by `assert_known_nodes` at compile, store and read. Both schema tickets run in W1. (DO-3 lists the import;
   see Open items.)
3. **NL-25 → NL-13.** The route wrapper declares its own small `SessionResolver` interface; sign-in implements it.
4. **NL-15 → NL-16.** `normalize_outline` takes the `StandardsIndex` as a parameter typed from DO-4; the real index
   joins in the S1 golden run (NL-84).
5. **Same-wave service collaborators** are typed structurally from DO-4 and tested with doubles: NL-29/31/50 → the
   recorder (NL-33); NL-53's loader and metrics writer are earlier-wave real objects.
6. **Composition roots.** Per-area wiring files created by A0 (NL-06, NL-07) and filled by exactly one named ticket
   once every real dependency is merged (table below). Five backend tickets fill their own (NL-25, 26, 34, 78, 53/54),
   which removes an integration hop before the full run (full run in W5, not W6).
7. **Full run without the UI.** NL-86's driver calls the HTTP API (Prism-tested); the full run (NL-112) needs the
   backend wiring, not the INT tickets.
8. **Evidence data is not a dependency.** INT e2e tests create their own users and lessons; only CON-3/4 (NL-94) waits
   for the standards seed.
9. **Docs start when their inputs are decided:** ARCHITECTURE and TRACEABILITY drafts in W0, README in W3; only the
   measured numbers wait (NL-139).
10. **Spikes.** SP-1 and SP-3 results are in hand, so no ticket waits on a spike and no "adopt spike values" ticket
    exists; the values are defaults in NL-01 and NL-20.
11. **Cuttable work blocks nothing core.** No core ticket depends on a cut ticket (NL-127 uses NL-119 only if it
    landed; NL-126 lists core INT tickets only).

**Edges kept that look like ordering but are real:** NL-24 → FW-4 (FW-4 owns `playwright.config.ts`, which every
UX-5a axe run needs); NL-77 → NL-26 and NL-78 → NL-27 (same service file); NL-88 → NL-34; NL-91 → NL-54 (both edit
`board-service.ts`); NL-53 → NL-44…47 (it wires the whole review area); NL-115 → NL-99 (approve writes the frozen
metrics row through the heartbeat/metrics wiring).

**Human gates in wave 0:** NL-02 provider keys, NL-03 voice key. Every other human ticket needs a merged result
(labels need verdicts, reviews need lessons, sign-off needs the walkthrough, recording needs the release candidate),
so it sits where its input lands.

**Same-wave import check** (result: clean after the removals above):

| Wave | Imports between same-wave tickets |
|---|---|
| W0 | none (FW-1 is a standalone package; NL-01 is the root) |
| W1 | none: NL-09/10/11 import nothing from each other; NL-06/07/08 import only NL-01 |
| W2 | none: all imports point at W0–W1 (ports → NL-09; wrapper → NL-11; compile/ydoc/checks → NL-09/10; FW-4 → FW-2/3) |
| W3 | none by import: services use NL-12 ports and NL-13; NL-29/31/50 → recorder typed from DO-4 §4; wiring is filled only by tickets whose real deps are earlier or their own |
| W4 | none: wiring tickets import W3 classes; FE screens import NL-24 shells and FW; NL-53 imports NL-38/48 (W3) |
| W5 | NL-105 ↔ NL-106 share no file: `commands/routes.ts` (NL-105) imports the `lock-and-snapshot.ts` shell from NL-07 (W1), which NL-106 fills |
| W6 | none: INT tickets import NL-105/106 (W5); load scripts use NL-49's `load/` shells |
| W7+ | XP slots only: each names its one change at 7b; two XPs touching the same prompt or policy file get an edge then |

**Critical path (13 tickets, W0–W12):** NL-01 platform → NL-09 schema → NL-12 ports → NL-29 lesson job runner →
NL-79 worker wiring → NL-112 full run → NL-120 error analysis → NL-128 XP-1 → NL-134 XP scoring/rerun → NL-137
release candidate → NL-138 video → NL-141 SUBMISSION walk → NL-143 portal. The tail from NL-112 is §9 and §10,
which no slicing can shorten. **Widest wave:** W4 (38). W3 has 29.

## Composition-root wiring owners (A0 files, one filler each)

| Wiring file | Created by | Filled by (wave) |
|---|---|---|
| web `wiring/auth.ts` (SessionService) | NL-06 | NL-25 (W3) |
| web `wiring/intake.ts` (OutlineService) | NL-06 | NL-26 (W3); NL-77 adds methods only, no constructor change |
| web `wiring/prompts.ts` (PromptService) | NL-06 | NL-34 (W3) |
| web `wiring/runs.ts` (RunService) | NL-06 | NL-78 (W4) |
| web `wiring/metrics.ts` (Board, Heartbeat, MetricsWriter) | NL-06 | NL-54 (W4); NL-91 adds a method only |
| web `wiring/review.ts` (LessonRead, Issue, Slot, Candidate, Transition, web CheckContextLoader, collab client) | NL-06 | NL-53 (W4) |
| web `wiring/export.ts` | NL-06 | NL-102 (W5) |
| web `wiring/assist.ts` (SuggestionService, web model client) | NL-06 | NL-116 (W6) |
| worker `wiring/generation.ts` | NL-07 | NL-79 (W4) |
| worker `wiring/checks.ts` | NL-07 | NL-81 (W4) |
| worker `wiring/judge.ts` | NL-07 | NL-110 (W5) |
| collab `wiring/server.ts` (auth, guard, persistence, acks) | NL-07 | NL-80 (W4) |
| collab `wiring/commands.ts` (+ `commands/routes.ts`) | NL-07 | NL-105 (W5); NL-106 fills `lock-and-snapshot.ts` |
| worker/collab `health.ts`, web `app/api/healthz` | NL-07 (shells) | NL-83 (W4) |

## Collision map (waves with more than one ticket)

**Standing rules for every wave:**
- **A0 owns** every workspace `package.json`/`tsconfig`, the root `package-lock.json` and the boundaries lint config
  (NL-01; NL-06 takes over `apps/web/package.json`/`tsconfig.json` and deletes FW-1's lockfile). A later ticket that
  needs a dependency raises it to the batch merge agent, which re-resolves the lockfile and runs the full suite (a
  lockfile change reaches everything).
- **All DDL** is in `packages/db/migrations/` (NL-08). No other ticket writes a migration; a needed column is a `CHG`
  and a new storage ticket.
- **`packages/core/src/ports.ts`** is NL-12's; changes go through a `CHG`.
- **Settings defaults** (`packages/config`) are NL-01's; **`CheckPolicy`** values are NL-20's.
- **API route folders** follow DO-4 §1, one owner per path. **No barrel files** on shared folders.
- **Append-style shared files** (keep both sides on conflict, never a reason to send a ticket back):
  `.claude/reference/area-map.md`, `.claude/state/icm-progress.md`, router rows, the build ledger,
  `docs/contracts/CHANGES.md`. **One-line-per-ticket files:** `docs/ux/05-verify/TRACEABILITY.md` (each FE/INT ticket
  edits only its SCR rows), `SUBMISSION.md` (each delivery ticket its own row), `PROJECT-CHECKLIST.md` (each ticket
  ticks only its own line). Dev log: one file per run.

| Wave | Shared surface | Owner (others read only) |
|---|---|---|
| W0 | root `package.json`, lockfile, root `.gitignore`, `docker-compose.yml` (Postgres only) | NL-01 |
| W0 | `apps/web/**` (FW-1's listed files) | FW-1 |
| W1 | `apps/web/package.json`, `apps/web/tsconfig.json`, root lockfile | NL-06 (FW-2/FW-3 never edit them; FW-1 installed Radix etc.) |
| W1 | `packages/schema/src/{ids,outline,unit-plan,lesson-draft,lesson,export}.ts`, emitter, `docs/contracts/schemas/**`, `docs/contracts/lesson-export.schema.json` | NL-09 |
| W1 | `packages/schema/src/api/**`, `packages/schema/tests/contract/**` | NL-11 |
| W1 | `packages/schema/package.json` | NL-01 (wildcard export map, so NL-09/11 never edit it) |
| W1 | `apps/web/src/server/{container.ts,wiring/**}` | NL-06 · `apps/{worker,collab}/src/{main.ts,wiring/**,health.ts,commands/**}` shells: NL-07 |
| W2 | `packages/core/src/intake/`: `standards-index.ts` + `packages/core/data/standards/**` NL-15; `{parse-grid,normalize,lesson-links}.ts` + `tests/fixtures/outline/**` (issued sheet, SYN) NL-16; `report.ts` + `tests/fixtures/report/**` NL-17 | as listed |
| W2 | `packages/core/src/checks/{registry,policy,gates,types}.ts`, `rules/structural/**`, the empty `rules/{alignment,safety,links,grounding,arc}/index.ts` shells | NL-20 |
| W2 | `docker-compose.yml`, Dockerfiles, `render.yaml`, `.dockerignore` | NL-23 |
| W2 | `apps/web/app/(dev)/**`, `apps/web/e2e/gallery/**`, `apps/web/playwright.config.ts` | FW-4 (after FW-4, each screen ticket owns `apps/web/e2e/<screen>/**`) |
| W3 | `packages/db/src/repos/*.ts`: sessions NL-25 · outlines NL-26 · runs NL-27 · job-queue NL-28 · model-calls NL-33 · prompts NL-34 · spend NL-35 · lesson-docs NL-36 · check-queue NL-37 · lessons NL-42 · review-extras NL-43 · metrics NL-48 · evidence NL-49 · exports NL-51 | as listed |
| W3 | `apps/worker/src/generation/`: `lesson-job-runner.ts` + `nodes/**` NL-29 · `run-finalizer.ts` + `queue/claim-loop.ts` NL-30 · `unit-plan-job.ts` NL-31 (all read NL-22's `pipeline/state.ts`) | as listed |
| W3 | `packages/core/src/checks/rules/{alignment,safety,links}/**` NL-39 · `rules/grounding/**` NL-40 · `rules/arc/**` NL-41 · `checks/context-loader.ts` NL-38 | as listed |
| W3 | `apps/web/app/api/lessons/[lessonId]/`: `route.ts` + `history/**` NL-44 · `issues/**`, `safety-flags/**`, `standards/**` NL-45 · `slots/**` NL-46 · `candidates/**` NL-47 · `heartbeats/**` NL-48 · `suggestions/**` NL-50 | as listed |
| W3 | `apps/web/app/api/units/route.ts` + `outline-versions/route.ts`, `outline-versions/import/**` NL-26 · `units/[unitId]/exports/**`, `exports/**` NL-51 · `runs/route.ts` NL-27 | as listed |
| W3 | `apps/web/src/lib/api-client.ts`, mock scripts, `src/test-utils/**`, `app/(app)/layout.tsx`, `app/sign-in/**`, nav config, every dialog/editor/action-bar shell | NL-24 |
| W3 | `evals/src/{runner,cli}.ts`, suite shells `evals/src/suites/s1…s14.ts`, `load/{spike,http-mix,yjs-mix}.ts` shells | NL-49 |
| W3 | root `README.md` | NL-52 |
| W4 | FE: each screen ticket owns its `app/(app)/…` route folder (IA), `src/features/<screen>/**`, `e2e/<screen>/**`; shells handed over from NL-24: StartRunDialog → NL-58, InsertQuoteDialog → NL-65, ResolveDialog → NL-66, SendBackDialog → NL-69, `src/editor/**` → NL-63, `src/features/workspace/actions/**` + heartbeat hook → NL-64, AssistPanel → NL-72 | as listed |
| W4 | `outline-service.ts`, `outlines.ts` (choices), `outline-versions/[id]/{report,choices}` | NL-77 |
| W4 | `run-service.ts`, `runs.ts`, `runs/[runId]/**` | NL-78 |
| W4 | `transition-service.ts`, `lesson-machine.ts` consumers, `lessons/[id]/transitions/**`, `wiring/review.ts` | NL-53 |
| W4 | `board-service.ts`, `heartbeat-service.ts`, `metrics-writer.ts`, `units/[unitId]/{board,metrics}/**`, `wiring/metrics.ts` | NL-54 |
| W4 | `apps/collab/src/{auth,permissions,persistence,acks}.ts` NL-80 · `apps/{worker,collab}/src/health.ts` NL-83 · `apps/worker/src/checks/**` NL-81 · `apps/worker/src/wiring/generation.ts` NL-79 | as listed |
| W4 | `ops/seed.ts` NL-82 · `ops/{backup.sh,run-sample-builder.ts}` NL-83 · `ops/import-spike.ts` NL-87 | as listed |
| W4 | suites: s1, s7 NL-84 · s2, s4 NL-85 · s9, s13 + `full-run-report.ts` + driver NL-86 | as listed |
| W4 | `prompt-service.ts` save path NL-88 · `packages/llm/src/openrouter-judge.ts`, `apps/worker/src/judge/**`, `repos/judge.ts` NL-89 | as listed |
| W5 | INT tickets: each owns `apps/web/e2e/integration/con-<n>/**` and its SCR rows; during its run it alone may fix the screens it joins (NL-93 owns SCR-2 and SCR-3; NL-96 owns SCR-6 and SCR-7 only) | as listed |
| W5 | `apps/collab/src/commands/{routes,apply-edit,set-mode}.ts`, `wiring/commands.ts` NL-105 · `commands/lock-and-snapshot.ts` NL-106 | as listed |
| W5 | `ops/faults/**` + s6 NL-107 · `evals/src/kickoff/**` NL-108 · s3 NL-109 · `wiring/judge.ts` + judge claim loop NL-110 · s12 + `evals/src/judge-calibrate/**` NL-111 · `evals/src/seed/**` + s10 NL-92 · `units/[unitId]/coverage/**` + `board-service.ts` coverage method NL-91 · `evals/reports/full-run-*.md` NL-112 | as listed |
| W6 | SCR-9 action bar split for the three INT tickets: `actions/standards/**` NL-113 · `actions/regenerate/**` NL-114 · `actions/submit/**` NL-115; SCR-9 evidence pane, SCR-10, SCR-11 NL-113; SCR-12 NL-114; SCR-14, SCR-15 NL-115; SCR-13 NL-116; SCR-18 NL-117 | as listed |
| W6 | `load/{spike,http-mix}.ts` NL-118 · `load/yjs-mix.ts` NL-119 · `docs/testing/error-analysis/**` NL-120 · `evals/src/heldout/**`, git-ignored `evals/local/` NL-121 · `evals/judge/labels.csv` NL-122 | as listed |
| W7 | `apps/web/e2e/integrity/**` + s5 NL-125 · `docs/ux/05-verify/QA_REPORT.md` + TRACEABILITY link column NL-126 · `evals/reports/load-*.md` NL-127 · each XP the files of its one change (edge added at 7b if two share a file) · `docs/delivery/*-demo-decision-inventory.md`, `*-angle-and-demo-framing.md` NL-131 · `evals/reports/judge-calibration.md` NL-132 | as listed |
| W8 | `docs/testing/experiments/**`, `evals/reports/full-run-*` refresh NL-134 · `evals/reports/seeded-*.md` NL-135 · `docs/delivery/*-demo-script.md`, `*-interview-prep.md` NL-136 · UX-5b gate line NL-133 | as listed |
| W10 | `docs/artifacts/*-demo-video.mp4`, `.demo/**` NL-138 · `docs/ARCHITECTURE.md`, `README.md`, `docs/AI-USAGE.md` NL-139 · `.claude/reference/area-map.md`, `.claude/README.md`, `.claude/state/icm-progress.md` NL-140 | as listed |
| W11 | `SUBMISSION.md` NL-141 · `docs/delivery/*-retro.md` NL-142 | as listed |

## Execution order for Phase B (Sonnet build loop)

1. **Waves in order, pipelined.** A ticket starts when its own blockers are merged and it passes
   `ticket_readiness.py` (backend/frontend need the §6 gate ticked first); it does not wait for its whole wave.
2. **Inside a wave, critical path first:** W0 NL-01 · W1 NL-09, NL-08 · W2 NL-12 · W3 NL-29 with NL-27, 28, 30–36, 42,
   43, 26, 25 · W4 NL-79, 81, 77, 78, 82, 86 · W5 NL-112 the moment its blockers merge (`gate::paid`, inside the PD-29
   $75 ceiling) · W6 NL-120 · W7 XP slots · W8 NL-134 · W9 NL-137.
3. **Slots.** At most about 6 implementers running tests at once (8-core VPS, CPUs − 2, each `-n 2` or less);
   planners and reviewers have their own allowance; `lane::direct` tickets run alongside without build slots;
   `lane::human` tickets get exact steps on the issue and block only what lists them.
4. **Plan → implement → test → review** per `build-loop-test-scope`; the 30 `risk::security` tickets get frozen tests
   first (`test-writer-agent`); `security-privacy-agent` runs once at each wave merge that contains one (W0–W6).
   Planners get a context pack, not a search (`planning-context-packs`).
5. **Batch merges in tree order.** One merge agent holds `main`; each round merges every reviewed ticket in dependency
   order (one `--no-ff` merge each), runs lint/format → typecheck → affected tests once on the union, pushes once;
   red → bisect, send back only the failing ticket and its dependants. **Full suite** only when a merge reaches
   everything (NL-01, NL-06, NL-08, NL-11, NL-12, any lockfile change) and at NL-137 before recording.
6. **Seam audit** per wave after its merge (checklist §8).
7. **Cut order.** Cuttable tickets are dispatched only after every core ticket of their wave is dispatched. If behind,
   drop in PD-17 order (#1 first). PRD §6.4 tripwires map to: "3-lesson trial" = NL-109 (rows 8, 9, 25 on the real
   model) → if it fails, drop cuts #1–#5; "one lesson draft → approved by two accounts" = NL-115 → if late, drop
   cuts #1–#7. The full run (NL-112) and honest numbers are never traded for a feature.

## Open items (for 7b, or for Innocent only where marked)

1. **DO-3 addenda to record at 7b** (design follow-ups, not decisions for Innocent): NL-09's structural ProseMirror
   type instead of importing `editor-schema` (edge removal 2); per-area wiring files under the one composition root
   (Metz B2); FW record refinement — FW-4 keeps `playwright.config.ts` and `e2e/gallery/**`, screen tickets own
   `e2e/<screen>/**`, NL-06 deletes FW-1's `apps/web/package-lock.json`.
2. **`hash_password` for the seed (NL-82).** DO-3 puts it in `apps/web/src/server/http/passwords.ts`; an ops script
   importing app internals breaks the dependency arrows. 7b picks one: move it to a small shared module (a `CHG` to
   DO-3) or seed accounts through a web-side script entry. Recommended: move to `packages/core/src/auth/passwords.ts`
   (`node:crypto` is allowed in core).
3. **Safety-flag writer at v1.** DO-3 says "worker (from `safety_note` rows)"; this plan puts it in the store node
   (NL-29). 7b confirms against DO-4 §6.
4. **New WF-41** (kickoff page generator, NL-108) must be registered in DO-6 by that ticket.
5. **DO-6 WF-1/WF-2 capture wording** still mentions refusal audit events (DO-4 open item 3); tickets follow INTERFACE
   shared guarantee 2 (a refusal writes no audit row).
6. **DO-7 Source column** still uses working names (DO-4 open item 1); tickets cite canonical tables.
7. **XP count is unknown** until NL-120: three slots; unused slots are closed, more are cut only from named `FT-N`.
8. **Deadline risk (Innocent's awareness, not a decision yet).** Due Tue 2026-10-27 03:00 CT. The tail after the full
   run is 7 waves of mostly human and direct work; the cut order and tripwires above are the levers.
