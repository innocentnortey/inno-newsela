# AI usage: Newsela Lesson Studio

Status: NL-139 draft of 2026-10-26. Everything below is taken from the project record (`docs/devlog/`, the PRD decision
table, `docs/plans/HANDOFF-PHASE-B.md`, `ops/vps-run/config.json`, `evals/reports/`). Where the record does not show a
fact, this document says so rather than estimating. Nothing here is a claim about quality beyond what a report states.

## (a) Tools and models used to build it

- **Claude Code on a VPS**, driven by a launcher script (`ops/vps-run/`), not by an AI supervisor. Decided in PD-34
  (2026-10-25): one main session ran **Phase A on Opus** (contracts, spikes, design, and writing every ticket) and
  **Phase B on Sonnet** (build, test, review, delivery). Phase B subagents also ran on Sonnet.
- **Why that split.** The handoff records that the specs for 131 of the 147 tickets were written by Sonnet, using
  Opus-written exemplars (the first 16 were written by Opus). The reason given is the run budget (PD-35), see
  [`plans/HANDOFF-PHASE-B.md`](plans/HANDOFF-PHASE-B.md). A planner that found a gap in a Sonnet-written spec was told to
  mark it rather than guess. Models were checked from the session's own output: the VPS preparation smoke test showed
  `claude-opus-5-5` only on the Opus run and a Sonnet-only service of a Haiku-requested subagent on the forced-Sonnet run
  ([`devlog/2026-10-25-vps-handoff-s6.md`](devlog/2026-10-25-vps-handoff-s6.md)).
- **Build loop.** For code tickets: plan, implement, test, review, with affected tests only; separate planner and
  implementer agents per slice; a security agent on tickets labelled security. Docs-only tickets ran as one agent with
  no build-loop gates (the "lane" rule). The ticket workflow lives in `.claude/`.
- **Earlier design work** (framing, PRD, hard-problem cards, UX direction, spikes) was done with Claude in interview and
  review sessions with Innocent; each entry is in `docs/devlog/`.

## (b) What the AI did, and what Innocent decided and reviewed

The AI drafted the PRD, designs, contracts, tickets, code, tests and documents. Innocent's decisions are recorded as PD
rows in [`prd/newsela-prd.md`](prd/newsela-prd.md). The ones that shape the build:

| PD | His decision (summary) |
|---|---|
| PD-15 | Host on Render; spend option D (local Compose, $0) on 2026-10-25 |
| PD-37 | Later, 2026-10-26: deploy to Render from the GitHub mirror (about $27/month, inside his $40/month cap); the repo does not record that this is live |
| PD-17 | Cut order for what drops first if behind (judge moved to #2, Yjs load script #1) |
| PD-29 | Model-spend ceiling for the product: $75 total, hard stop |
| PD-33 | Capacity target: 500 users a day, a 200-user concurrent spike |
| PD-32 | Standing authorization: Claude's recommended option is adopted for ordinary product, UX, architecture, implementation, testing and delivery decisions; human-only evidence stays labelled as such |
| PD-34 | Execution moves to the VPS, Opus then Sonnet |
| PD-35 | VPS run budgets and recovery (later relaxed, see (e)) |

Two things this means in practice. First, many decisions after 2026-10-25 were **adopted by the AI under his standing
authorization (PD-32)**, and the record labels them that way; they are not individual sign-offs. Second, automated
checks never count as his walkthrough or user test. Work that needs his eyes or his money is still open at the time of
writing: the look-sheet comparisons, the real-model full run (NL-112, needs his yes to spend), the ~30 judge labels
(NL-122), his measured review sessions (NL-123), seeded errors (NL-124), the demo recording and submission.

## (c) What the product itself uses AI for, and where it does not

- **Used:** one structured model call to plan the unit (`UnitPlan`), then one call per lesson to draft it (`LessonDraft`),
  with at most one repair call when code checks fail (the settled design, hard problem HP-1; spike SP-1). The model is
  Anthropic `claude-sonnet-5-5` at low effort per the handoff note; prices and ids are confirmed at build time (PD-12).
- **Used, optional and built:** AI assist (a rewrite suggestion that a person accepts or rejects) and regenerate-as-candidate.
  An advisory alignment judge on a second provider is built as code (with a calibration script); it never blocks Approve.
  As of this writing the judge has not been calibrated, because the labels it needs do not exist yet.
- **Not used:** intake (the sheet is normalized by plain code, no model call), the check suite (code), submit/freeze,
  and approval (a second human account approves the exact version it was shown). A model never approves a lesson.
- **State of the stack so far:** every run in the repository's reports used the **stub provider** (no model call).
  The reports state `provider_mode: stub` and `cost_usd: 0`. The real-model full unit run has not happened.

## (d) Where the AI was wrong, and how it was caught

Examples from the dev logs, with the catch in each:

1. **A security review caught missing guards on the "append-only" tables** (NL-08): the triggers did not cover `TRUNCATE`,
   and the version guard was too loose. Fixed with statement triggers and an allow-list, with new tests
   ([`devlog/2026-10-25-nl-08-security-fixes.md`](devlog/2026-10-25-nl-08-security-fixes.md)). The follow-up (a non-owner
   runtime role) was done in the Compose stack; on Render one owner role is used, recorded as accepted risk AR-1.
2. **The connected-app walk (NL-126) found 4 blocking, 6 major and 8 minor problems** the unit tests had passed over:
   the unit confirm returned 422, the Compose collab URL was wrong, the editor socket did not connect, and the stub run
   could not generate. 18 issues were filed and fixed ([`devlog/2026-10-26-nl126-qa-walk.md`](devlog/2026-10-26-nl126-qa-walk.md)).
3. **The demo-accounts box showed credentials the seed never created** (found in the G1 acceptance run). Fixed with one
   shared constant read by both, and a test ([`devlog/2026-10-26-demo-accounts.md`](devlog/2026-10-26-demo-accounts.md)).
4. **A capacity report mislabelled a metric and misattributed a cause.** The NL-127 report called the stored-latency
   figure "M-24", which is reconnect time; the follow-up corrected it. The 1,310 `check.failed` lines it left unexplained
   turned out to be a load unit with no outline version, not a checker fault
   ([`devlog/2026-10-26-nl127-followup.md`](devlog/2026-10-26-nl127-followup.md)). The 6.0 s stored-latency miss itself
   is still open ([`delivery/capacity-report.md`](delivery/capacity-report.md)).
5. **Spike spend was under-recorded.** The importer found only 13 usage rows ($0.964) for SP-1 against a $3.55 ledger
   figure and roughly $1.7 real spend; the record says it is understated rather than inventing calls
   ([`devlog/2026-10-25-w4-nl87.md`](devlog/2026-10-25-w4-nl87.md)).
6. **The PRD's issued-sheet counts were recalled, not computed.** A real-stack run (NL-94) computed 6 errors and 16 ELD
   findings over 9 distinct codes against the PRD's 5 and 7; recorded as PD-36, with tests asserting the computed numbers.

**Not yet available:** the error-analysis round (NL-120), whose `FT-N` failure types would show how the real model's drafts
fail. It needs the real-model full run first, so no `FT-N` exists and none is claimed here
([`testing/error-analysis/README.md`](testing/error-analysis/README.md) is its protocol only).

## (e) Spend

- **Product model spend (the $75 ceiling, PD-29, metric M-29).** What a report shows: SP-1 recorded usage rows of
  $0.964 across 13 calls, with the record noting a $3.55 ledger figure and roughly $1.7 real spend (understated, see (d)5).
  Every later evaluation and load report is stub-mode with `cost_usd` 0, and the NL-127 load run made no real call
  (`grep -c api.anthropic.com` = 0). The real-model full run, the draft golden and any experiment have not run, so there is
  **no spend to report for them**; this document does not estimate it.
- **Claude Code usage on the VPS.** PD-35 set dollar budgets for the build sessions (Phase A at most $150 per run and $300
  in total; Phase B at most $200 per run and $600 in total). The launcher config later records that Innocent removed the
  dollar caps on 2026-10-25 ("I'm on a subscription"); run counts and the served-model check remained, and usage is
  logged as an API-equivalent estimate. The only dollar figure in the committed devlog for the sessions is the
  $1.03 smoke test; per-run totals are in `ops/vps-run/logs/` and are **not summarized here**.

## (f) Data handling

- **Restricted material.** Crawled Newsela content lives in a git-ignored folder (GR-9). It is never committed, mounted
  into a container, put in a prompt or a fixture. Agents are instructed never to read it, and the project record contains
  no entry that says one did. That is an instruction and a review, not a technical block, and it has not been independently
  audited.
- **Keys.** Provider keys come only from the shared workspace env file through the launcher, passed by name; they are not in
  project files, images or prompts. This document contains no key.
- **Data.** All test, eval and demo data is synthetic (GR-13); no student or teacher-of-record data. Model traces stay in the
  project's own Postgres (PD-19).
- **Framing.** The tool is expert-driven: it drafts and checks, and a named person reviews and approves (GR-16).
