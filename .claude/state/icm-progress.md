# ICM progress checklist
Tracks context-system maturity only; product work and status live in [PROJECT-CHECKLIST.md](../../PROJECT-CHECKLIST.md), GitLab issues (once `origin` exists) and [SUBMISSION.md](../../SUBMISSION.md).
Update the affected row in the same task as the change, with an evidence link.
Status: pending (names its unblocking event) · provisional · established · verified · n/a (reason).
Made by `icm-project` **v1.5.0** (Phases 1 and 3), invoked 2026-10-24 at zero-to-hero Stage 0.

| Milestone | Status | Evidence / owner | Next check — enabled by |
|---|---|---|---|
| Work home, sources and owners located | established | 2026-10-24: sources ranked in the [source register](../../docs/source/source-register.md); restricted captures git-ignored (`git check-ignore` matches `docs/source/restricted/`) | Re-checked 2026-10-24 at §2: samples in [`docs/data/`](../../docs/data/README.md) read only tracked files; nothing copied from `restricted/` |
| Purpose, audience and domain meaning (representative task) | established | 2026-10-25: [PRD v1.0](../../docs/prd/newsela-prd.md) approved at §4 under Innocent's instruction; task: a reviewer takes a messy sheet's drafts to approved lessons | Re-check if Innocent reopens a §1–§4 item |
| Environment, tools and collaboration | established | 2026-10-25: VPS working copy authoritative (PD-34); GitLab `origin` private project 2346, pushes over HTTPS via glab credential helper (SSH stalls; [dev log](../../docs/devlog/2026-10-25-phase-a-opus-pa1.md)); demo under local Docker Compose (PD-15 D) | Re-check at the first deploy (§8) |
| Blueprint and first delivery step | established | 2026-10-25: §6 DO-1…DO-7 `ready` ([interview register](../../docs/prd/interview.md)); [slice plan](../../docs/plans/slice-plan.md) names wave 0 (FW-1, NL-01…NL-05) as the first delivery step | Re-check when wave 0 merges |
| Entry → router → maintenance instruction | established | [CLAUDE.md](../../CLAUDE.md) → [router](../README.md) → [maintenance](../rules/context-maintenance.md); `check_context.py` 2026-10-24: ok, no FAIL | Re-run at each gate |
| Fresh-context route walkthrough | verified | 2026-10-25 (Phase A, after the area map): from `CLAUDE.md` → router → each Stage 1–7 row resolves to an existing file (design docs, area map, contracts, slice plan, tickets, handoff); `check_context.py` ok | Repeat at the §8 first merge |
| Code design: planned locations | established | 2026-10-25: [DO-3 code design](../../docs/design/code-design.md) mirrored to [area map](../reference/area-map.md) (every path labelled planned); router row added; Metz review in [docs/design/reviews/](../../docs/design/reviews/2026-10-25-code-design-review.md) | Each §8 slice moves its rows planned → actual |
| Physical scaffold | pending | — | NL-01 / FW-1 create the workspace spine (wave 0) |
| Routes verified against code and tests | pending | — | First implemented slice with tests (§8) |

Last reconciled: 2026-10-25 — Phase A: §5 spikes, §6 design, §7 ticketing.
