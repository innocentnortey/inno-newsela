# Stage 5 · Spikes — fan-out build, light testing

Added 2026-10-18 at Innocent's instruction (YourAI project): spikes are built **in parallel by
fan-out agents** with **light testing**, not one option at a time. Owner of the stage contract:
`ARTIFACT-MAP.md` §5. This file is the procedure.

## What a spike is (concrete first)

A spike is a **small, time-boxed experiment that answers one uncertain question** on a hard-problem
card before design starts. It produces **numbers and a short record**, never product code.

> **Example (YourAI, HP on detection):** *Question:* is Presidio alone good enough to find the
> identifiers in our worked pairs, fast enough?
> *Fan-out:* agent A builds Presidio with default recognizers; agent B builds Presidio plus our
> shape-based recognizers; agent C times both on a 2,000-word synthetic document. All three run
> at once.
> *Output:* `SP-1` with a table of recall per identifier type, misses, and milliseconds per
> document. The HP card becomes `proven (SP-1)`, choosing B, or goes back to Innocent if neither
> is good enough.

## Why fan-out

Options in a spike are independent by construction (they are alternatives). Building them one
after another wastes wall-clock time and invites anchoring on the first result. Building them in
parallel, against one shared scoring harness, makes the comparison fair and fast.

## Procedure

0. **Where it runs.** Compute-heavy spikes (model downloads, many agents, load tests) run on the
   **VPS** (`claude-vultr`), with the same model as the driving session
   (`~/.claude/rules/match-model-on-vps.md`). Check free disk first; stop and ask if under ~5 GB.
1. **Spike brief** (orchestrator, ~10 min), at the top of `docs/analysis/spikes/SP-N-<slug>.md`:
   the question · the HP card it decides · the options (A, B, C …) · the worked pairs it is scored
   on · the measures and the pass line, written **before** anything runs · the time box.
2. **Scoring harness first** (one agent, or the orchestrator): a small script that runs any option
   on the worked pairs and prints the measures (recall/precision per type, latency, failures),
   plus a tiny smoke test that the harness itself runs. Commit it on the spike base branch and
   record its SHA. **Option builders may not edit it.** This is the light version of the build
   loop's frozen-test contract.
3. **Fan out.** One builder agent per option, **dispatched in a single message** so they run
   concurrently, each in its own branch `spike/SP-N-<option>` and worktree, using the build loop's
   plumbing (`Gauntlet AI/.claude/skills/tdd-swarm/scripts/worktree.sh`; first prompt line: the
   absolute worktree path). Worktrees for spike fan-out are authorized by this procedure
   (Innocent, 2026-10-18); everywhere else the opt-in rule still applies. Builders run Sonnet
   per house convention unless the spike is about model quality.
   **Each option is a `fanout-planner` → `fanout-implementer` pair** (2026-10-19, Innocent;
   `.claude/rules/fanout-plan-then-implement.md`): the planner writes the option's plan into its
   worktree, and the implementer builds from it.
   Each builder: implements its option as throwaway code, runs the harness, reports the numbers
   and an ASSUMPTIONS block. Up to 3 attempts, then report what blocked it.
4. **Light testing, by design.** Skip the build loop's test-writer, reviewer, slop, security and
   visual gates: spike code is never merged. Keep exactly three checks:
   - the harness SHA is unchanged on every branch (tamper check);
   - the orchestrator (or one verifier agent) **re-runs the harness on each branch** and trusts
     those numbers, not the builders' summaries;
   - synthetic data only, and no live paid API calls unless Innocent allowed them for this spike.
5. **Decide.** One comparison table (option × measure, pass line marked) in the SP record, plus
   the result and the recommendation. The HP card's status becomes `proven (SP-N)` when an option
   clears the pass line; otherwise it returns to Innocent as options. **Innocent reads the result**
   before Stage 6 uses it.
6. **Clean up.** Remove worktrees; keep branches as `archive/spike/SP-N-<option>`. Nothing from a
   spike branch is merged into product code; Stage 8 rebuilds the chosen option under the full
   build loop with real tests.

## Light vs full mode

| | Full | Light |
|---|---|---|
| Which cards | any card below "confident" | only a card that is truly uncertain |
| Options per spike | 2–4 | 2 (the recommendation and its strongest rival) |
| Time box | as stated in the brief | ≈ 30–60 min wall-clock |

## What a spike is not

- Not a head start on the build: its code is thrown away.
- Not a substitute for Stage 6 design: it feeds design one measured answer.
- Not approval of anything else: running a spike never implies a later stage is skipped.
  Each stage skip is its own decision, asked separately (lesson from YourAI, 2026-10-18).
