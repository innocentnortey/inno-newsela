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

Split: 122 build-loop · 17 direct · 8 human; 4 foundation · 23 frontend · 65 backend · 55 integration (incl. 4 wave-0
non-implementation tickets); 30 `risk::security`. Waves W0–W12; widest W4 (38); critical path 13 tickets
(NL-01 → NL-09 → NL-12 → NL-29 → NL-79 → NL-112 → NL-120 → NL-128 → NL-134 → NL-137 → NL-138 → NL-141 → NL-143).

<!-- REGISTER:START -->
<!-- REGISTER:END -->

## Execution order

The slice plan's *Execution order for Phase B* governs; in short:

1. Waves in order, pipelined: a ticket starts when its own blockers are merged and `ticket_readiness.py` says READY.
2. Critical path first inside a wave (W0 NL-01 · W1 NL-09, NL-08 · W2 NL-12 · W3 NL-29 … · W4 NL-79 … · W5 NL-112).
3. About 6 implementers running tests at once; planners/reviewers have their own allowance; `lane::direct` tickets run
   alongside; `lane::human` tickets get exact steps on the issue (Innocent) and block only what lists them.
4. Plan → implement → test → review; frozen tests first only for the 30 `risk::security` tickets; `security-privacy-agent`
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
