# Shared agents

The generic multi-gate review team, extracted from Selph's agent orchestration (2026-07). Available when Claude is launched at the Nortorious-Technologies root.

| Agent | Model | Role |
|---|---|---|
| `research-brainstorm-agent` | Opus | Always-first architecture/planning; one recommended approach; owns inventories-as-hypotheses judgment |
| `inventory-verifier` | Haiku | Advisory grep-evidence for brief claims; prompt-injection-hardened; never blocks on its own |
| `code-review-agent` | Sonnet | Quality gate: spec fidelity, contract consistency, async safety, invariants; terse PASS / structured FAIL |
| `qa-agent` | Sonnet | Independent spec-compliance audit; derives cases from the spec, not the implementation |
| `resource-pressure-agent` | Sonnet | 3-layer memory audit (static accumulators / runtime retention / capacity math); always shows the math |
| `security-privacy-agent` | Sonnet | Final gate: data ownership, sensitive inference, auth, PII, LLM safety, injection |
| `fanout-planner` | inherit | Plans one slice of a parallel coding task: reads its specs and the current code, writes a plan file, no code (2026-10-19) |
| `fanout-implementer` | Sonnet | Builds one planned slice inside its owned files, runs its checks, reports evidence (2026-10-19) |
| `metz-code-design-agent` | inherit | Code-design review in Sandi Metz's voice: SOLID, seams cut vs deferred, dependency direction, wrong abstractions; writes one review file, no code (zero-to-hero §6 DO-3; 2026-10-20) |

Reviewers, auditors and the implementer run on Sonnet (Innocent, 2026-10-19); planners and `research-brainstorm-agent` stay on the stronger tier. Conventions all six share: each defers to a project's own fork in that project's `.claude/agents/` when one exists; each reads the target project's `CLAUDE.md` + `rules/` before judging; reviewers never modify code; PASS output is terse (~5–10 lines), FAIL expands only Critical/High/Medium.

Project-adapted forks (Selph's, Werewood's) stay in their own repos — promote an agent here only when it is genuinely project-agnostic. Builder agents (pipeline/schema/surface) are inherently project-specific and live with their projects. **Exception:** the generic `fanout-planner` → `fanout-implementer` pair is the default for any fan-out coding slice in a project without its own pair (`../rules/fanout-plan-then-implement.md`).
