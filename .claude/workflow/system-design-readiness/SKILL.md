---
name: system-design-readiness
description: Before any Gauntlet system design, check that the project's docs actually hold the information the design needs. Audits the issued brief, PRD and design docs against a 60-item checklist and checks the register of seven required design outputs (system design, architecture, code design, component contracts, evaluation plan, observability contract, key-metrics registry); sorts each gap into go-find (issued), research (external), decide (Innocent's call) or assume-and-measure; interviews Innocent on the decisions; and blocks the design until every required item is cited, decided, labelled as an assumption, or ruled out. Use before writing or substantially revising ARCHITECTURE.md, a requirements or system-design doc, or a system-design diagram for any Gauntlet project (weekly builds, hiring-partner projects such as Equinox), and whenever he says "system design", "design readiness", "are we ready to design" or "what's missing before we design".
---

# System Design Readiness

**What it does:** before you design anything, it checks that the information a design depends on
(who the users are, what's promised, how much work arrives, what each request costs, what happens
when something fails) is already written down in the project's docs. It produces a report of what's
missing and how to get each piece. You then go and find the missing pieces, or decide them with
Claude, before the design starts.

**Why:** a system design is only as defensible as its inputs. In the 2026-10-08 cohort session the
sizing exercise produced server counts from user numbers alone. Innocent's objection, "you're not
even factoring in what's going on in your actual architecture" [00:44:24], is the gap this closes.

**Files in this skill:**

- `GUIDELINE.md`: the 8-step design process, the four kinds of fact, a worked sizing example, and
  the decision sentence. This is for Innocent to read.
- `CHECKLIST.md`: the readiness items (`SD-<step>.<n>`), each with a Kind, a Tier and where it's
  usually found.
- `templates/readiness-report.md`: the report this skill writes.
- `DESIGN-OUTPUTS.md`: the seven outputs every design must produce, the minimum contents of the
  evaluation plan, observability contract and key-metrics registry, and the four separate gates
  (interview complete → design ready → ticket ready → implementation verified).
- `templates/design-outputs.md`, `evaluation-plan.md`, `observability-contract.md`,
  `key-metrics-registry.md`: starting points for the register and the three contract outputs.
- `scripts/design_outputs.py`: the structural checker for the register and those three outputs.
  Tests: `python3 -m unittest discover -s tests`.

## Where it sits in the workflow

It runs **after the PRD is approved** (`gauntlet-prd-workflow` step 2), or once a hiring-partner
brief is in hand, and **before** `ARCHITECTURE.md`, the requirements doc or `to-tickets`. Run it
again whenever scope moves (a re-plan, a new brief version, a staff answer that changes a
constraint).

## Process

1. **Find the project and its source ranking.** Work in the build repo (`inno-*`). Read its
   `CLAUDE.md` for which sources outrank which. For hiring-partner projects the brief is the
   boundary; Equinox's is `.claude/rules/brief-conformance.md`.
2. **Read before asking.** Read the issued brief or PRD, the requirements doc, `ARCHITECTURE.md`,
   `KEY_METRICS.md`, `USERS.md`, `SUBMISSION.md`, the decision records, the open questions, and any
   cost or load docs. Never ask Innocent something a doc already answers. If a `prd-interview`
   document exists, read it first: its *Checklist coverage* already dispositions every item
   (`answered` = Found or Decided, `assumed`, `n/a`, and `needs-decision` / `needs-research` =
   Missing). Verify its citations rather than redoing the sweep. For a large repo, give the
   sweep to a subagent along with `CHECKLIST.md` and keep only the filled table.
3. **Set the depth first.** If SD-1.9 (the hardest uncertainty) isn't recorded, it's the first
   interview question. From it, mark each step *full*, *light* or *n/a* with a reason, and work out
   which tiers apply (Full, AI, Legacy).
4. **Audit every required item.** Give each a status (Found / Decided / Assumed / N/A / Missing)
   and its evidence (file and section or line, or a URL and the date checked). Quote issued facts
   exactly. Tell *silent* sources (the item becomes a Decision) from *ambiguous* ones (the item is
   Missing, so ask).
5. **Write the report** from `templates/readiness-report.md`, next to the project's requirements
   or architecture doc; if neither exists, use `docs/design/system-design-readiness.md`. Keep one
   living report per project, update it in place, and add a line to its audit log on each run.
6. **Give Innocent the verdict first,** then three short lists:
   - **Go find:** for each item, exactly which doc to recheck or who to ask (staff, the hiring
     partner), with a ready-to-send question.
   - **Decide:** the decisions the interview will close.
   - **Assumed:** each stand-in and the test that will replace it.

   Don't paste the full audit into chat; it's in the report.

   Then check the **design outputs register** (`DESIGN-OUTPUTS.md`). It lives in the
   `prd-interview` document when one exists, otherwise add it to the readiness report from
   `templates/design-outputs.md`. Every output needs an owner, a location (a file, or a named
   section for a small project) and sources citing the readiness items it draws on. Run
   `python3 scripts/design_outputs.py check <register> --gate readiness`. A missing owner or
   location is a **Decide** item; an output marked `n/a` needs a reason a reviewer could
   disagree with.
7. **Run the decisions interview, foundation questions first and before any design.** Follow
   `.claude/rules/system-design-questioning.md`: SD-3.1 (load target and scale path), SD-3.4, SD-7.2,
   SD-1.6 and SD-1.9 are asked before DO-1 is drafted, load first. A test condition, default or
   public count is never recorded as their answer. If Innocent is away, draft only what doesn't
   depend on them. If a `prd-interview` document exists, continue in it: add or
   reopen its questions there rather than starting a parallel interview. One step per turn, at
   most four questions. For each, explain
   the concept in two or three sentences, then offer 2–4 concrete options with a recommendation
   that he can pick or remix. Record each decision in the project's decision record, not only in
   the report.
8. **Re-audit when he brings back what he found.** Update the statuses, then re-state the verdict.
9. **Once it's READY, hand off to the design.** Follow `GUIDELINE.md`. Write each section into
   the doc that owns it (`ARCHITECTURE.md`, `KEY_METRICS.md`, the requirements doc), not into a
   parallel design doc. Every major decision completes the decision sentence, and
   `design-doc-defense.md` applies. The design fills the seven outputs at the locations the
   register names, updating each row's status (`planned` → `draft` → `ready`).
10. **Ticket readiness is a separate gate.** The design is complete enough for `to-tickets` only
   when `python3 scripts/design_outputs.py check <register> --gate tickets` passes: every output
   `ready` or justified `n/a`, and the evaluation plan, observability contract and key-metrics
   registry hold their minimum contents. Then a reviewer confirms the judgement items listed at
   the end of `DESIGN-OUTPUTS.md`, including the signature-completeness check, the spec dry run
   and the coverage requirements sweep (*Before the ticket-ready gate*, added 2026-10-21). READY
   (step 6) never implies ticket-ready.

## Rules

- **Never fill an Issued gap with a plausible guess.** This is the Gauntlet source-discipline
  rule. Program-level unknowns go to `Gauntlet AI/open-questions.md` as `GQ-N`. Project-level ones
  go in the build repo's own open-questions list.
- **Measure items never block, and are never dressed up as measured.** "Assumed: 10 requests per
  user per day (no data yet; replaced by the demo-session trace)" is fine. "10 requests per user
  per day" with no label is not.
- **External facts carry a checked date.** Prices, rate limits and API behaviour change.
- **Keep targets, assumptions, calculations and measurements visibly separate** in everything this
  skill writes (`GUIDELINE.md` → *The four kinds of fact*).
- **Four gates, never merged.** Interview complete, design ready, ticket ready and implementation
  verified answer different questions (`DESIGN-OUTPUTS.md` → *Four gates*). Report each one
  separately and never infer one from another.
- **No assumed tool, architecture or number.** The observability contract names no tracing tool
  unless a constraint chooses it; the metrics registry carries no target nobody approved.
- **The checklist is a floor, not a script.** If the project has a hard input the checklist
  doesn't name, audit it anyway and propose adding it to `CHECKLIST.md`.
