# Where this pilot came from

**Source:** an outline Innocent supplied on 2026-10-18, titled *"An AI-first UX design workflow using Claude Code"*, which he got from ChatGPT ("research verified October 18, 2026"). It described:
- six gated phases: PRD → planning → conceptualisation → structure → high-fidelity prototype → verification;
- linked IDs (REQ → US → FLOW → SCR → TEST);
- a free-first tool list: Stitch, Penpot, Mermaid, shadcn/ui + Vite, Playwright MCP, Storybook, Figma notes;
- a starter repository of eight skills and a `gate.py`.

The starter ZIP was not available to Claude, so nothing here is copied from it.

**Kept:** five of the six phases (all but the PRD phase) and their human questions; one orchestrator before many agents; Markdown as the source of truth; returning to the phase that owns a failure; reopening downstream approvals when an upstream artifact changes; the four-value QA outcome; never inventing user-test results.

**Changed, and why:**

| Outline | Here | Why |
|---|---|---|
| Review files with `Status: APPROVED` and a `gate.py` | Zero-to-hero ★ gates recorded as "Innocent ✓ date" in `PROJECT-CHECKLIST.md`, plus a visual review page per gate | One gate convention across the whole sequence. Pages already have a checker |
| ID chain REQ → US → FLOW → SCR → TEST | **REQ → US → FLOW → SCR → CON → TEST** | Innocent's addition: every screen must name the backend contract it depends on, so the UX feeds §6 DO-4 and §7 tickets |
| Playwright MCP for browser work | Chrome DevTools MCP for interactive work; Playwright *Test* + axe for repeatable evidence | The global rule prefers DevTools MCP; tests give reproducible evidence |
| Stitch as the main design path | Stitch for variants once a key exists; Claude-drawn wireframes as the always-available fallback | Stitch needs Innocent's account; the pilot must not stall on it |
| Phase 1 *PRD & product definition* with its own gate, and a separate `PRD.md` | **Dropped as a phase** (Innocent, 2026-10-18). The pipeline starts at Planning; the PRD is a prerequisite owned by zero-to-hero §1–§4, and the checklist won't open §4b until §4 is ticked. A UX gap check (`templates/UX_GAPS.md`) may feed the §4 interview | One owner and one gate per fact. The first Riverside run had a PRD-lens phase, which duplicated the §4 gate |
| Prototype against local synthetic data | Prototype against a **Prism mock of the UI contracts** | The prototype then proves the contracts are sufficient, and the same tests later check the real backend |

**History note (pilot v2, 2026-10-25):** the outline's high-fidelity prototype phase was kept as UX-4 until 1.14.1; since v2 it is an optional focused prototype for a named uncertainty, the frontend is built in §8 against Prism mocks of the shared spec in `docs/contracts/`, and verification splits into UX-5a (during the build) and UX-5b (final acceptance). Source: `zero-to-hero/proposals/2026-10-25-concurrent-frontend.md`.
