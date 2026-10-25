> Superseded in part by `2026-10-25-concurrent-frontend.md` (zero-to-hero 2.0.0); kept as history.

# Proposal — Parallel UX and System tracks after the user stories

**Status: APPLIED 2026-10-19** (zero-to-hero v1.5.0), triggered by Innocent signing HouseAccount's UX-5
gate ("yeah it looks good to me"). Agreed earlier the same day; HouseAccount's ux-pipeline learnings were
folded into `ux-pipeline/references/phases.md` and `tooling.md` at the same time. The "Still open"
questions below were not decided by applying it.

## Why (Riverside, 2026-10-18/19)

Riverside had UX-1 and UX-2 signed and UX-3 awaiting review while every hard-problem card (HP-1…)
was still `open`. Under the linear order, Stage 5 spikes could not start until the whole UX track had
passed — yet a spike reads only the worked pairs (§2) and the HP cards (§3), never a screen. The
stages are the same; some of them simply do not depend on each other.

## The agreed shape

```
0 → 1 → 2 → 3 → 4 PRD★ → UX-1 user stories★ ─┬─ UX track:     UX-2 concept★ → UX-3 screens + contracts★ → UX-4 prototype★ → UX-5 verify★ ─┐
                                               │                                                                                            ├─► 7 tickets → 8 build → UI verify again★ → 9 → 10
                                               └─ System track: 5 spikes → 6 system design (architecture, code design, area map) ───────────────┘
```

1. **Linear up to the fork.** §0–§4 and UX-1 are unchanged. The fork happens at the UX-1 gate
   (PRD approved **and** user stories signed).
2. **The contracts are the only agreement between the tracks.** Drafted in UX-1 (draft CONs in the
   flows), signed at UX-3; §6 design consumes them (they become the DO-4 component contracts). A
   contract change after either side has used it reopens that contract on **both** tracks (extend
   ux-pipeline's existing reopen rule across tracks). A spike result that changes what a screen needs
   is such a change.
3. **UX-5 closes the UX track before tickets** — Innocent reviews the prototype and confirms it makes
   sense. After §8 build, the same UX-5 checks run again against the real backend (UI verify again).
4. **§7 tickets wait for both tracks:** UX-5 signed **and** §6 design gate passed. Nothing is built
   before tickets.
5. **The prototype is the real frontend, so §8 is backend + plumbing.** No double work:
   - the app lives in its real folder (e.g. `web/`), not `prototype/` — "prototype" is a milestone;
   - mock-only machinery (Prism `Prefer:` headers, fake session, state switcher, call log) sits in a
     dev-only layer that is switched off, never in the client the screens call;
   - no screen invents data; if Prism's static examples can't show a state, the fake lives in the
     mock layer;
   - TypeScript types are generated from the OpenAPI file, so a contract change breaks the build;
   - the frontend stack is the house default (React + Vite + TS + shadcn, ux-pipeline `tooling.md`);
     §6 takes it as given and does not re-choose it;
   - UX-4 code goes through the normal code-review gate (it is production code).
   - §8's frontend work is one integration step per contract: point it at the real backend once the
     backend passes its contract tests against the same OpenAPI file.

## Two sessions at the fork (Innocent, 2026-10-19)

Right after the UX-1 gate is ticked, work splits into **two sessions**, and the project must remind us:

- **Checklist callout** at the UX-1 gate line in `PROJECT-CHECKLIST.md`:
  `▶ FORK — open a second session for the System track now (§5 spikes → §6 design).` with: where to
  launch it (same machine/VPS as the project's working copy, same model per
  `~/.claude/rules/match-model-on-vps.md`), what it reads first (PRD, `USER_STORIES.md`, draft CONs in
  `USER_FLOWS.md`, `docs/design/hard-problems.md`, `docs/data/worked-pairs.md`), and the track's first
  unticked gate.
- **Guard hook** (`~/.claude/hooks/zero-to-hero-guard.py`): `gate_status` today returns only the first
  unticked gate. Make it report one current gate **per track**, and when the UX-1 gate is ticked but
  §5 has no evidence yet, inject the fork reminder at session start.
- **Ownership so the sessions don't collide:** the UX session ticks §4b rows and owns the contract
  files (`UI_CONTRACTS.md`, the OpenAPI); the System session ticks §5–§6 rows and requests contract
  changes rather than editing them. Whoever reaches the join first does not cut tickets until both
  gates are ticked.

## Edit list when applied

- `zero-to-hero/SKILL.md` — diagram, "why this order" item 6, resume rule ("first unticked gate *per
  track*"), Modes table if needed, version 1.4.0 with a changelog line.
- `zero-to-hero/ARTIFACT-MAP.md` — §4b/§5/§6 preconditions; §7 gate requires UX-5 + §6.
- `zero-to-hero/templates/PROJECT-CHECKLIST.md` — §4b and §5–§6 laid out as two tracks; the fork
  callout; ownership note.
- `.claude/rules/new-project-zero-to-hero.md` — the "no tickets" hard stop names both tracks' gates.
- `ux-pipeline/SKILL.md`, `references/phases.md`, `references/tooling.md` — prototype-is-the-frontend
  rules; UX-5 runs twice; contracts consumed by §6; cross-track reopen.
- `~/.claude/hooks/zero-to-hero-guard.py` — per-track gate report + fork reminder (read it fully first).
- Root `CLAUDE.md` toolkit line for zero-to-hero / ux-pipeline — mention the two tracks.

## Still open (ask Innocent separately)

- Whether to convert **Riverside's** checklist to two tracks and start its spikes alongside UX-4.
- Whether **HouseAccount** itself (UX-1 signed 2026-10-19, so at the fork now) gets a System-track
  session before the skill change lands.
