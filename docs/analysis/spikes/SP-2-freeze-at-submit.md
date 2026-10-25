# SP-2 · Freeze at Submit while two people type (HP-5, HP-4)

**Status:** run 2026-10-25 — **PASS (option A recommended)**; brief written before anything ran.
**Mode:** light (`.claude/skills/zero-to-hero/references/spikes.md`): the recommendation and its strongest rival.
**Branch / worktree:** `spike/SP-2`, `/home/linuxuser/workspaces/.worktrees/newsela-SP-2`.
**Plan for the builder:** [`docs/plans/fanout/2026-10-25-spikes/SP-2.md`](../../plans/fanout/2026-10-25-spikes/SP-2.md).
**Throwaway code:** `spikes/sp2/` (never merged into product code; Stage 8 rebuilds the chosen option under the build loop).

## Spike brief

### The question

Does freezing a lesson at Submit keep approval pinned while two people type?

In concrete terms: reviewer A and reviewer B are typing in the same paragraph of Lesson 4's Learning in Action
section, one character every 100 ms each. A clicks Submit at a random moment. B's next keystrokes are already
on the wire. We need to know, for each freeze mechanism:

- whether any keystroke that reaches the server after the lock ends up in the stored lesson or in the
  server's live copy;
- whether every keystroke the server confirmed before the lock is still there after a reload, and every
  keystroke it did not keep was reported to the person who typed it;
- whether the content hash survives the trip Y.Doc → derived ProseMirror JSON → Postgres → back;
- whether an approver's old tab (an earlier snapshot's hash and state vector) gets a 409 that changes nothing;
- how long one store transaction takes on a lesson of about 3,300 words.

### The cards it decides

- **HP-5 · Approval integrity under live co-editing and AI edits** (`docs/design/hard-problems.md` → HP-5, its
  *Needs a spike?* section and its addendum). Chosen option B: "Submit freezes; the approver approves the frozen
  snapshot (pin kept)". Status line: "SP-2 confirms it; if SP-2 fails, freeze by closing all connections at Submit."
- **HP-4 · Which copy of a lesson is canonical** (same file → HP-4). Chosen option A: Y.Doc is authoritative, each
  durable store writes the Y.Doc bytes, the derived `Lesson` JSON normalized through the schema, its SHA-256 and the
  state vector in one transaction. HP-4 adds two pass lines to SP-2: round-trip hash identity on a fixture using the
  custom nodes (`callout`, `collapsible`, a table), and store transaction p95 ≤ 500 ms.
- Also exercised: PRD PD-7 (both halves), PD-9 (one Hocuspocus process, our Postgres), R-26 and R-33 as amended in
  PRD §5.4; `docs/contracts/INTERFACE.md` CON-12 (collaboration channel guarantees: "After a lock: 0 edits persisted;
  every keystroke is either in the snapshot or reported as refused to its typist"; "Round trip JSON → Y.Doc → JSON keeps
  the hash") and CON-18 (`submit`, `approve`, `request_changes`; `STALE_PIN` 409, `NOT_STORED` 409; "Submit includes the
  lock and flush … SP-2 measures it").

### The options

| Option | What it is | Source |
|---|---|---|
| **A** (recommended) | Submit sets a server-side frozen flag; every existing connection to the lesson is switched to read-only on the spot, and a `beforeHandleMessage` guard refuses (and reports) any update that still arrives. New connections to a frozen lesson are read-only. Approval pins the snapshot's content hash + state vector; a stale pin gets 409. | HP-5 option B as chosen |
| **B** (rival) | Submit sets the same frozen flag, then closes every connection to the lesson (`closeConnections`) and lets clients reconnect, read-only, before the snapshot. Same pin and 409. | HP-5 *If it fails* line (the named fallback) |

Both options share everything except the freeze mechanism: the same Hocuspocus server, schema, store transaction,
snapshot, pin comparison and state machine. That shared code is part of the frozen harness, so the comparison measures
only how each option stops existing connections from changing the document.

A no-freeze control (Submit writes a snapshot but leaves connections writable) is built into the harness. It is not an
option; it exists to prove the scorer catches late edits.

### What it is scored on

- A synthetic lesson shaped like WP-1's Lesson 4 (`docs/data/worked-pairs.md` → WP-1): five sections (Launch, Literacy
  Lab, Learning in Action, Look Back, Homework), about 3,300 words, using `paragraph`, `heading`, `routine_heading`,
  `callout`, `collapsible`, lists, an A–D `ordered_list` and a `table` with header cells, plus front matter in a Y.Map.
  It is produced by a seeded script (`spikes/sp2/harness/fixture.ts`, seed `20261025`) from hand-written block
  templates and a neutral word list. No Newsela text, nothing from `docs/source/restricted/`.
- The typing target is the first paragraph of Learning in Action (WP-1's Part A slot area). Every keystroke inserts a
  unique token (`{A0001}`, `{B0001}` …) so each one can be traced after a reload.
- 20 trials per option, seeds `1000 + trial` (the same seeds for both options), so Submit lands at the same random
  moment for A and B.

### Deviations from the HP-5 setup, and why

| HP-5 says | SP-2 does | Why |
|---|---|---|
| Postgres persistence | PGlite (`@electric-sql/pglite`, Postgres compiled to WebAssembly, in-process) | No Docker on this host; PGlite still runs real SQL in one transaction, so the store-time measure exercises the same statements |
| Playwright with three browser contexts | Node `HocuspocusProvider` clients typing through Yjs `XmlFragment` edits in the shape `y-prosemirror` produces | No browser needed to answer a server-side question; the server sees the same Yjs messages |
| Script step 7, "the option A variant: approve while A and B are typing" | Not run | Light mode runs two options; the live-pin variant was rejected at §3, and the freeze fallback is the stronger rival |
| Four-eyes, AI suggestions, regenerate, cross-lesson links | Not tested | Not in SP-2's question or pass line; covered by golden tests at Stage 8 |
| HTTP call from the web app to the collaboration process | In-process function calls on the collaboration server | The question is where the lock and comparison happen (HP-5 reason 3), not the transport |

### Measures, written before anything runs

Per trial (each must hold in 20 of 20 trials):

1. **No edits after a lock.** After Submit, and again after Approve plus attempted typing, nothing new appears in the
   server's live document or the stored row: the count of keystroke tokens present there and absent from the snapshot
   is 0, both hashes equal the snapshot hash, and a fresh client's reload shows the approved hash.
2. **No silent keystroke losses.** Every keystroke the server acknowledged is present after reload; every keystroke
   that is absent was typed into an editor the server had already told was read-only, or was followed by a
   `refused` / read-only message to its typist. A bare disconnect does not count as telling the typist.
3. **Round trip keeps the hash.** For every stored row and snapshot of the trial: re-deriving the JSON from the stored
   Y.Doc bytes gives the stored hash and state vector; the JSON read back from Postgres `jsonb` hashes to the same value;
   JSON → new Y.Doc → JSON gives the same hash.
4. **Stale approve is refused.** After request changes, an edit and a resubmit, approve with the first snapshot's hash
   and state vector returns 409 `STALE_PIN`, and no lesson, version, approval or audit row changes.
5. **The approver's client hash equals the server's snapshot hash** before approving (HP-5 script step 6).

Per run: **store transaction p95 ≤ 500 ms** over every store (debounced stores, Submit's flush and 50 benchmark stores),
plus p50, and Submit duration p50/p95 (reported, not scored). Also reported: keystrokes refused at the lock that come
back after the lesson is unfrozen ("resurrected"), as an observation for Stage 6.

### Pass line (verbatim, from the HP register's *Spikes* table)

> 20/20 runs per assertion; 0 edits persisted after a lock; 0 silent keystroke losses; JSON round trip keeps the hash; store p95 ≤ 500 ms

### Decision rule

- A meets the pass line → HP-5 becomes `proven (SP-2)` with option A's mechanism; HP-4's round-trip and store-time
  lines are `proven (SP-2)`.
- A fails and B meets it → HP-5 stays option B with the fallback mechanism (close all connections at Submit), as its
  status line already says; record what A got wrong.
- Both fail, or the round trip or store time fails → back to Innocent as options (`decision-requests-story-driven`).
- Both pass → A, because it keeps every session, cursor and awareness state, with no reconnect storm at each Submit.
- Innocent reads the result before Stage 6 uses it.

### Time box and budget

≤ 2 h wall-clock, $0. No model calls, no network calls beyond `npm install`. Check `df -h /home` (≥ 5 GB free) first.

### Tamper check

The harness (`spikes/sp2/harness/`, `package.json`, `package-lock.json`, `tsconfig.json`) is committed alone first;
its SHA is recorded below. `git diff --stat <harness SHA> HEAD -- spikes/sp2/harness spikes/sp2/package.json
spikes/sp2/package-lock.json spikes/sp2/tsconfig.json` must print nothing on the final branch. The orchestrator re-runs
`npm run sp2 -- --option A --trials 20` and `--option B` and trusts those numbers, not the builder's report.

- Harness SHA: _(to be recorded)_

## Results

_Filled by the orchestrator (main session) from its own re-run of the harness on 2026-10-25 (harness
`919ac12`, unchanged on the branch: `git diff --stat 919ac12 HEAD -- spikes/sp2/harness spikes/sp2/package.json
spikes/sp2/package-lock.json spikes/sp2/tsconfig.json` printed nothing). Control row from the builder's run
(`spikes/sp2/results/control.txt`, 3 trials). ✓ = meets the pass line._

| Measure | Pass line | A · read-only flip + guard | B · close all connections | Control (no freeze, sanity) |
|---|---|---|---|---|
| No edits after a lock | 20/20, 0 edits | 20/20, 0 ✓ | 20/20, 0 ✓ | 0/3 (150 edits after lock) |
| No silent keystroke losses | 20/20, 0 losses | 20/20, 0 ✓ | 20/20, 0 ✓ | 3/3 |
| Round trip keeps the hash | 20/20 | 20/20 ✓ | 20/20 ✓ | 3/3 |
| Stale approve → 409, no change | 20/20 | 20/20 ✓ | 20/20 ✓ | 3/3 |
| Approver client hash = server hash | 20/20 | 20/20 ✓ | 20/20 ✓ | 3/3 |
| Store transaction p50 / p95 (n) | p95 ≤ 500 ms | 13.0 / 25.1 ms (130) ✓ | 13.2 / 25.8 ms (130) ✓ | — |
| Submit duration p50 / p95 (info) | — | 23.4 / 29.8 ms | 24.2 / 30.4 ms | — |
| Resurrected keystrokes (info) | — | 0 | 120 (6 per trial) | — |
| Verdict | | **PASS** | **PASS** | FAIL (as it must) |

Re-run: `cd spikes/sp2 && npm run sp2 -- --option A --trials 20` (and `--option B`), on branch `spike/SP-2`
(kept as `archive/spike/SP-2-*` after clean-up).

**Result:** both options clear every pass line; the control proves the scorer catches late edits. Option A
(server-side read-only flip plus a guard that refuses updates after the lock) keeps 0 resurrected keystrokes;
option B also passes, but refused local edits come back ("resurrect") when the clients reconnect after an unfreeze
(6 per trial).

**Recommendation:** **A**. HP-5 becomes `proven (SP-2)` with option B (Submit freezes; approval pins the snapshot's
hash + state vector) implemented by A's mechanism; HP-4's two added pass lines (round-trip hash identity, store p95)
are proven too. Design rule carried into DO-3/DO-4 and the editor tickets: on a refused update the editor drops its
refused local edits and tells the typist (this is what made B resurrect keystrokes; A needs it only for the
`refused` notice path). Adopted under Innocent's standing authorization (PD-32), 2026-10-25. **Innocent has not
read this result yet.**

**Limits:** PGlite stands in for Postgres (store times are indicative; the R-57 probe re-measures on real Postgres),
and Node providers stand in for browsers. Blocking checks were stubbed as an integrity re-derive.

**Assumptions reported by the builder:** PGlite for Postgres; Node providers for browsers; B also closes sockets
(Hocuspocus 4.7.1 `closeConnections` leaves the socket open); a disconnect is not counted as telling the typist;
Submit holds a server-side direct connection during the lock; checks stubbed.
