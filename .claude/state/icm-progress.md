# ICM progress checklist
Tracks context-system maturity only; product work and status live in [PROJECT-CHECKLIST.md](../../PROJECT-CHECKLIST.md), GitLab issues (once `origin` exists) and [SUBMISSION.md](../../SUBMISSION.md).
Update the affected row in the same task as the change, with an evidence link.
Status: pending (names its unblocking event) · provisional · established · verified · n/a (reason).
Made by `icm-project` **v1.5.0** (Phases 1 and 3), invoked 2026-10-24 at zero-to-hero Stage 0.

| Milestone | Status | Evidence / owner | Next check — enabled by |
|---|---|---|---|
| Work home, sources and owners located | established | 2026-10-24: sources ranked in the [source register](../../docs/source/source-register.md); restricted captures git-ignored (`git check-ignore` matches `docs/source/restricted/`) | Re-checked 2026-10-24 at §2: samples in [`docs/data/`](../../docs/data/README.md) read only tracked files; nothing copied from `restricted/` |
| Purpose, audience and domain meaning (representative task) | established | 2026-10-25: [PRD v1.0](../../docs/prd/newsela-prd.md) approved at §4 under Innocent's instruction; task: a reviewer takes a messy sheet's drafts to approved lessons | Re-check if Innocent reopens a §1–§4 item |
| Environment, tools and collaboration | provisional | 2026-10-24: Mac working copy, no remote; PRD PD-15 records Render as host, spend over the $40/mo cap open (local Docker Compose fallback) ([setup profile](../README.md#setup-profile)) | Innocent creates GitLab `origin` and decides hosting spend |
| Blueprint and first delivery step | provisional | 2026-10-25: [hard-problem register](../../docs/design/hard-problems.md) (10 chosen cards, SP-1…SP-3) and the design-outputs register DO-1…DO-7 in [interview.md](../../docs/prd/interview.md); first delivery step = SP-1 | §6 writes DO-1…DO-7 at the registered locations |
| Entry → router → maintenance instruction | established | [CLAUDE.md](../../CLAUDE.md) → [router](../README.md) → [maintenance](../rules/context-maintenance.md); `check_context.py` 2026-10-24: ok, no FAIL | Re-run at each gate |
| Fresh-context route walkthrough | provisional | 2026-10-24: every Stage 1 router row resolves to an existing file except the review page (in progress) | Review page lands; repeat walkthrough at the §1 gate |
| Code design: planned locations | pending | — | Stage 6 writes `.claude/reference/area-map.md` |
| Physical scaffold | pending | — | Directory spine created after the code design |
| Routes verified against code and tests | pending | — | First implemented slice with tests (§8) |

Last reconciled: 2026-10-25 — Stage 3 hard problems and Stage 4 interview.
