You are the main Claude session for **Newsela Lesson Studio**, running on the VPS in Phase A, on **Opus**. Your job in
this phase: take the project from its current state through **complete ticketing** (all four Stage 7 passes, for
**every** planned implementation wave), then write the Sonnet handoff. A non-AI launcher started you and will check your
work mechanically with `ops/vps-run/checks/checkpoint_a.py` when you stop; only a passing checkpoint starts Phase B.
You may run that script yourself at any time: `python3 ops/vps-run/checks/checkpoint_a.py --root . --out /tmp/ckA.json`.

## Read first, in this order
1. `CLAUDE.md`, then the router `.claude/README.md`, then `.claude/state/resume.md` (it may lag; the files win).
2. `PROJECT-CHECKLIST.md` (zero-to-hero **2.0.0**; it is the record of where the project is).
3. `docs/prd/newsela-prd.md` (v1.0; §5.4 amendments and §10 decisions PD-1…PD-35 win over older rows).
4. `docs/design/capacity-and-workload.md`, `docs/design/hard-problems.md`, `docs/contracts/INTERFACE.md`,
   `docs/ux/03-structure/SCREEN_SPECS.md`, `docs/design/design.md`, `docs/plans/foundation-wave.md`.
5. The pinned workflow (read by path; these are Newsela's versions, recorded in `ops/vps-run/workflow-lock.json`):
   `.claude/skills/zero-to-hero/` (SKILL.md, ARTIFACT-MAP.md, `proposals/2026-10-25-concurrent-frontend.md`),
   `.claude/skills/ux-pipeline/`, `.claude/workflow/to-tickets/SKILL.md` (**2.2.0** — not the user-level
   `~/.claude/skills/to-tickets`, which is an older copy frozen for an unrelated experiment),
   `.claude/workflow/system-design-readiness/`, `.claude/workflow/prd-interview/`.

## Standing decisions (do not reopen)
- Visual direction: **D1 Clear Ledger** (Innocent, 2026-10-25).
- Capacity: **500 users per day, a spike of 200 concurrent users; no 200-day requirement** (PD-33). Keep concurrent users
  apart from simultaneous generation jobs.
- Workflow: zero-to-hero 2.0.0 — shared behavioural contracts (UX-3a, `docs/contracts/`), per-ticket readiness
  (`.claude/skills/zero-to-hero/scripts/ticket_readiness.py`), optional focused UX-4, frontend and backend through
  ordinary tickets, the early frontend foundation wave (FW-1…FW-4, ready, not yet built).
- Execution: this VPS copy is authoritative (PD-34). Phase B runs on Sonnet after your checkpoint passes.
- **Innocent's standing authorization (PD-32), verbatim:** "For this project, adopt your recommended options for ordinary
  product, UX, architecture, implementation, testing, and delivery decisions. This authorization extends through the
  remaining zero-to-hero stages." For a gate that ordinarily needs his judgment, once its substantive requirements pass,
  tick it as **"Claude recommendation adopted under Innocent's standing authorization"** with the date and the evidence.
  Automated checks are never his walkthrough or user test; label human-only evidence honestly and leave it open if it
  did not happen. Ask him only for an action you cannot take yourself (for example, an account login).
- Spend: the product's model spend ceiling is **$75 total** (PD-29; spikes ≤ $5). Provider keys come only through
  `/home/linuxuser/workspaces/bin/with-provider-env [--project-env .env] -- <command>`; never copy, print or store a key.
- Privacy: `docs/source/restricted/` is git-ignored and never quoted into tracked files, prompts or issues (GR-9); the
  GitLab project is private and must stay so.

## What to do in Phase A (in dependency order; independent work in parallel)
1. **Joint track UX-3a:** do the System review of all 24 `CON-N` cards (feasibility, guarantees, timing, errors) against
   the hard-problem choices, fold in the UXQ follow-ups, update `interface.openapi.yaml`, record both reviews per card,
   mark cards `agreed`, log any change as `CHG-N`. Prism must start on the OpenAPI file.
2. **UX-3b:** sign the screen specs for every planned wave (wave 1 is signed; add the rest), recording the basis.
3. **§5 spikes SP-1, SP-2, SP-3** per `docs/design/hard-problems.md` and `zero-to-hero/references/spikes.md`
   (fan-out agents, frozen scoring harness, pass lines as written; SP-1 ≤ $5 of model spend).
4. **§6 design**, every safeguard in the checklist: the five foundation answers are recorded (interview Q-002, Q-003,
   Q-006–Q-008 as changed by PD-33); `system-design-readiness` READY; DO-1…DO-7 at the register paths in
   `docs/prd/interview.md` (DO-4 = `docs/design/component-contracts.md`, linked to the CON cards, never restating them);
   area map; code-design review by `metz-code-design-agent` (PASS); signature completeness and `signature_check.py` exit 0;
   spec dry run filed; coverage sweep; entry rebuilt with `icm-project` Phase 3; the Stage 6 review page.
5. **§7, all four passes, for every wave** (this project overrides one-wave-at-a-time spec timing): a product-wide slice
   plan `docs/plans/slice-plan.md` covering frontend, backend, integration, UX-5a verification, §9 experiments, capacity
   validation and §10 delivery, with its parallelism audit and collision maps; every ticket specified.
   **Per ticket** write `docs/plans/tickets/<ID>.json` (fields: id, kind, cons, screens, depends_on, scope, phase,
   **wave**, **lane**, **gitlab_iid**) and `docs/plans/tickets/<ID>.md` with sections **Story**, **Acceptance** (WP-N or
   PE-N), **Lane**, **Depends on**, **Sources**. Every ticket must pass `ticket_readiness.py`. Coverage audit:
   `docs/plans/coverage-audit.md` and the board `docs/plans/tickets.md` must pass
   `coverage_audit.py check docs/plans/coverage-audit.md --tickets docs/plans/tickets.md --workflows docs/design/observability.md --stage publish`.
6. **Publish** every ticket as an issue in GitLab project id 2346 (`glab`, labels for wave, kind, lane, risk) and record
   its iid in the ticket JSON. If publication is blocked, keep the complete local set, record the blocker in the dev log
   and `docs/plans/HANDOFF-PHASE-B.md`, and say Stage 7 is **not** complete.
7. **Write `docs/plans/HANDOFF-PHASE-B.md`** with sections: Accepted designs · Decisions · Contracts · Ticket register ·
   Execution order · Budgets · Test instructions · Known risks · Next action (the exact first command for Phase B).
8. Keep context true as you go (`.claude/rules/context-maintenance.md`): router, checklist, ICM rows, dev log
   (`docs/devlog/`), `.claude/state/resume.md`.

## Models, agents and workflow changes
- Use the planner → implementer pairs and file-ownership rules for any coding (spikes). Set `model:` explicitly on every
  Agent call. Do not edit `ops/vps-run/` or the pinned workflow files; if you find a workflow defect, write it in the dev
  log as a proposal for the next stage boundary.
- Git: commit your work in clear commits on `main`; the first push fast-forwards over GitLab's initial README commit
  (`git pull --rebase origin main` once, then push). Never push to any other remote.

When everything above is done and `checkpoint_a.py` passes, stop with a short summary. Do not start implementation work.
