---
name: to-tickets
description: Turn an approved plan, PRD or conversation into implementation-ready GitLab issues, shaped for maximum safe parallelism (dependency waves, collision map, fresh-agent handoff), with a full-set coverage audit that traces every mandatory requirement through every workflow to the ticket that integrates it, and per-ticket observability, evaluation and metrics responsibilities. User-invoked only.
---

# To Tickets

Version 2.2.0, 2026-10-25. Files: `references/coverage-audit.md` (the audit's format and
findings), `templates/coverage-audit.md`, `templates/implementation-plan.md` (the plan contract
projects copy), `scripts/coverage_audit.py` (checker; tests: `python3 -m unittest discover -s
tests`).

*2.1.0 (2026-10-21, lessons from the AEA call-center Stage 7 run, at Innocent's instruction):* a
*Which model does which step* section (Opus slices, specs and resolves; Haiku sweeps; Sonnet builds
and reviews; `model:` set and checked on every Agent call); four §2a patterns (build against the
signature, one provider module for routes, all shared DDL in the storage ticket, and a same-wave
import check that is part of the audit); a new §4b for resolving open items by topic; concrete
missed cases in §2c; the one-line AC note in §3; and, in the coverage-audit template and reference,
the `WF-n only — <reason>` / `excludes WF-n (reason)` forms for every/all/each/never requirements
plus running the requirements sweep at the design gate.

*2.2.0 (2026-10-25, zero-to-hero 2.0.0, approved by Innocent; spec
`Nortorious-Technologies/.claude/skills/zero-to-hero/proposals/2026-10-25-concurrent-frontend.md`):*
tickets come in four **kinds** (backend, frontend, integration, foundation) and readiness is checked
**per ticket** (§0, `zero-to-hero/scripts/ticket_readiness.py`), not "both tracks closed"; frontend
tickets build against mocks of the one agreed interface spec (`docs/contracts/`), never against a
prototype; an early frontend foundation wave may be cut before §6; the slice plan and coverage audit
stay product-wide while specs are written one wave at a time; presentation work is accepted by
presentation examples (`PE-N`); a `kind::` label and a `Kind:` handoff line on every issue.

Turn an approved plan, PRD or conversation into implementation-ready GitLab issues. The output is
judged on two things: each issue stands alone as a fresh-agent handoff, and the set as a whole lets
as many agents work at once as the real dependencies allow. Reference instance of the shape this
skill must produce: the Equinox issue set (`inno-equinox`, 39 issues, waves 0–8, 2026-10-09) and
its batch plan `inno-equinox/docs/plans/batch-foundation-pipeline.md`. That set predates the
2026-10-11 additions (ticket-ready gate, coverage audit, per-ticket Observability / Evaluation /
Metrics sections), so use it for shape and parallelism, not as proof of coverage.

## Which model does which step

| Step | Model |
|---|---|
| Slicing (§2), writing ticket specs (§3–§4), resolving open items (§4b) | Opus |
| Fast search and evidence sweeps (§4b step a, source lookups) | Haiku |
| Implementers and reviewers (*Implementation handoff*) | Sonnet (workspace rule `fanout-plan-then-implement.md`) |

Set `model:` explicitly on every Agent call, and check which model the agent actually ran on before
relying on its output. On 2026-10-21 the `model: haiku` sweeps were reported as not Haiku, but their
transcripts record `message.model = claude-haiku-5-5`. Check the served model from the transcript
(`message.model` vs `requestedModel`) or the `PostToolUse(Agent)` `resolvedModel`, never the agent's
self-report (VPS harness review, 2026-10-25, folded in at the 2.2.0 sync). Why: Innocent
stopped the Sonnet-run slicing of AEA ("we should have been using Opus to create the slices").

## 0. Check ticket readiness

Tickets are cut from a finished design, not from an approved PRD. When the project has a design
outputs register (`system-design-readiness/DESIGN-OUTPUTS.md`; it lives in the `prd-interview`
document or the readiness report), run:

```bash
python3 "<Gauntlet AI>/.claude/skills/system-design-readiness/scripts/design_outputs.py" \
  check <register> --gate tickets
```

(`system-design-readiness` sits beside this skill's original in `Gauntlet AI/.claude/skills/`; the
user-scope `~/.claude/skills/to-tickets` is a symlink to it, so resolve the path from there.)

It passes only when all seven outputs (system design, architecture, code design, component
contracts, evaluation plan, observability contract, key-metrics registry) are `ready` or justified
`n/a`, and the evaluation plan, observability contract and metrics registry hold their minimum
contents. If it fails, report what is missing and stop unless the user explicitly accepts cutting
tickets against an incomplete design; then record that acceptance and label every affected issue
`gate::design`. A project with no register gets one from `templates/design-outputs.md` in
`system-design-readiness` before tickets, at the depth the project needs (a small project's
outputs can be named sections of one document). Interview completion and design readiness do not
substitute for this gate.

**Readiness is per ticket, by kind** (zero-to-hero 2.0.0, spec §3). The design gate above governs
feature tickets; on top of it each ticket kind has its own conditions:

| Ticket kind | Ready when | Does **not** need |
|---|---|---|
| **Backend** feature | §6 gate ticked **and** every `CON-N` it serves is `agreed` in `docs/contracts/INTERFACE.md` | UX-3b, UX-4, UX-5 |
| **Frontend** feature | §6 gate ticked **and** its screen spec (`SCR-N`) is signed **and** every `CON-N` it uses is `agreed` | a UX-4 prototype; UX-5 acceptance |
| **Integration** | *Planned* any time with explicit dependencies; *executed* once the frontend and backend tickets it joins are merged against the same agreed `CON-N` | — |
| **Foundation (FW)** | UX-2 direction picked **and** design tokens written **and** `docs/plans/foundation-wave.md` exists (stack and its decision, owned files, bounded scope, dependencies, ticket specs, review requirements) | the §6 gate (it is presentation-only) |
| `lane::direct` / `lane::human` / `lane::spike` | as before (workspace rule `ticket-lanes.md`) | — |

Check each ticket before it is specified as ready and again before it is started:

```bash
python3 "<Nortorious-Technologies>/.claude/skills/zero-to-hero/scripts/ticket_readiness.py" \
  check <ticket.json> --root <repo>
```

(`{"id", "kind", "cons", "screens", "depends_on", "scope", "phase"}`; exit 1 lists the missing
conditions, e.g. "CON-18 is `proposed`".) A ticket it rejects is not ready, whatever its wave says.
**A prototype is never a dependency**: no ticket waits on UX-4 or UX-5, and an incomplete screen spec
for one feature never blocks otherwise-ready backend work. Work citing a `CON-N` that is `changing`
(a `CHG-N` in `docs/contracts/CHANGES.md`) is marked `reconcile: CHG-N` and waits; unrelated work
continues.

**FW foundation tickets** are limited to design tokens, typography, basic accessible components
(button, link, input, badge/status pill, banner, card, table, tabs, stepper, dialog shell) and layout
primitives (app shell, sidebar, page header, split panes). Anything behaviour-dependent
(permissions, autosave, resumability, booking or job state, data fetching, backend error recovery,
real-time collaboration) is a frontend feature ticket on the normal path. Checklists from
zero-to-hero 1.x (no `Joint track` heading) keep their old rule until migrated.

## 1. Gather only the necessary context

Read the source specification and relevant code or architecture. If given an issue or document,
read its full authoritative contents. Read the canonical interface spec (`docs/contracts/INTERFACE.md`
cards with their statuses, `interface.openapi.yaml`, `CHANGES.md`) and, for frontend work, the screen
specs and `design.md`. Read the design outputs too: the component contracts (with
every consumer they list), the evaluation plan, the observability contract (its workflow registry
is the list of every `WF-n` the tickets must cover) and the key-metrics registry. Use the project's domain vocabulary and preserve qualifiers
from the source. Inspect the target project's ticket-planning and execution workflow, if one
exists, before drafting: the issue is the next agent's input, so include the fields that workflow
actually consumes. Do not assume another project's agents, ledger, labels or review gates apply.
If the project has no planning chain and the user wants one, copy and adapt an existing chain
(Equinox's `plan-ticket` / `plan-batch` / `execute-batch` + `reference/ticket-build-workflow.md`)
into the project in the same session; never point a project at another project's skills. Whatever
chain the project uses, its per-ticket plan must meet the contract in
`templates/implementation-plan.md` (see *Implementation handoff*).

Check the publishing surface early: which GitLab host and project, whether `glab` is authenticated
against that host (`glab auth status`; pass `--hostname` or use `glab api` with the full project
path when the default host is gitlab.com), existing labels and issues, and whether the instance
tier supports `blocks` issue links (Free tier does not; Equinox uses `relates_to`).

## 2. Draft vertical slices

Each issue should deliver one narrow, end-to-end behaviour that is independently demonstrable or
verifiable and fits in a fresh implementation context. Split work when it contains independent
stateful invariants or product questions; do not split merely by file or layer. Cut along the code design's module boundaries (DO-3; workspace rule
`code-design-solid-modularity.md`) so issues in the same wave own different modules behind agreed interfaces. A source's
delivery slices are a starting point, not the ticket list: a slice that bundles several invariants
(an "orders + checkout + ledger" slice) becomes several issues, and behaviour the slices leave
implicit (the screens that drive a library, the seed that proves a report) gets its own issue.

Give every issue explicit blocking edges. An issue with no unfinished blockers is ready to start.
Name the owning area and any shared contract or integration surface defined by the target project.
If two issues must change the same surface, give them a blocking edge or combine them; keep other
issues unblocked. Compute dependency waves from those edges. Do not call a ticket ready for an
agent when it still needs a product decision, a permission, a secret, a prior contract or an
implementation plan required by the project's workflow.

Use expand–migrate–contract for a mechanical refactor whose blast radius cannot stay green as one
vertical slice.

**Name every implementation ticket's kind** (§0): backend, frontend, integration or foundation. A
**backend** ticket names the `CON-N` it serves; a **frontend** ticket names the `SCR-N` it builds and
the `CON-N` it uses, and is built against the Prism mock and generated types from
`docs/contracts/interface.openapi.yaml`, so it has **no blocking edge on the backend tickets** that
serve the same contract; an **integration** ticket joins one frontend and one backend ticket against
the same agreed `CON-N` (blocked by both) and proves the real round trip. A behaviour that has both a
screen and a service is therefore usually three tickets, two of them parallel. Write the
**product-wide slice plan** and the coverage audit for the whole product, but write implementation
specs **one wave at a time** (§3–§4 for the next ready wave only).

**A shared component is not its consumers.** When a requirement applies to several workflows and
one ticket builds the shared adapter or helper, each consuming workflow still needs a ticket that
wires it in and proves it at that workflow's entry point. Usually that is the ticket already
changing that workflow; otherwise add one integration ticket per workflow or owning area, each
blocked only by the component ticket, so the consumers stay parallel.

**New entry points are registered, not discovered.** A ticket that adds or changes an entry point
or experiment names its `WF-n` from the observability contract. If the workflow is not in the
registry yet, registering it (a row in the contract, the evaluation and metrics it inherits, its
capture check) is part of the design or an earlier ticket, never something the builder may skip.

### 2a. Parallelism audit — run it before showing the breakdown

A first draft almost always carries false dependencies. Walk every edge and ask "does the blocked
issue need the blocker's *result*, or only something the blocker happens to sit next to?" Remove or
re-route every edge that fails. The patterns that recur:

- **Human and external gates go to wave 0.** Creating a hosting project, a repo, a credential or an
  account depends on nothing in the code. Put it in wave 0 with a `gate::human` label so the person
  can clear it while agents build; leave only the *use* of that resource (deploy, remote migration)
  on the later ticket.
- **Split a shared module by consumer.** When a downstream issue needs one small function from an
  area whose other work carries an unrelated invariant (checkout needs `decrementStock`, not
  restock/revalue), split the area: the small core in an early wave, the invariant-carrying rest in
  parallel with its consumer. The design still owns the area; the tickets own the order.
- **Frontend against the mock, integration later.** A frontend ticket waits for its contract to be
  `agreed`, never for the backend that implements it; the integration ticket carries the edge to both.
  Foundation (FW) tickets sit in the earliest wave and block only the frontend tickets that import them.
- **Land shells and contracts early.** A layout/nav/identity shell, a shared type module, a
  canonical serializer, a test harness: anything every later issue builds on gets its own early
  ticket so that later tickets collide on nothing. The owner of each shared file is named once.
- **Evidence data is not a dependency.** A report or page proves its criteria with test-created
  data; the demo/seed story that makes the evidence prettier is a cross-issue check at
  integration, not a blocker.
- **Docs start when their inputs are decided, not when the code is deployed.** Only the line that
  needs the live result (a URL, a measured number) waits; it moves to the submission ticket.
- **Required items block the deploy; committed extras block the demo.** A first deploy does not
  wait for lowest-priority scope; the recording and submission do.
- **Build against the signature, prove at integration.** A ticket that calls a service built in the
  same or a later wave receives it by constructor, graph dependency or the one web
  dependency-provider module (`deps.py`), and tests against a double that honours the component
  contract's (DO-4) signature; integration tickets wire the real objects and prove each seam. A
  planner who needs more than the signature records `blocked-on`, never invents. (AEA: critical path
  9 → 6, widest wave 12 → 24.)
- **Routes resolve services through one provider module,** declared in an early ticket together with
  the auth guards (`require_staff`), so every route ticket is proven against the OpenAPI with
  dependency overrides instead of waiting for the real services.
- **All DDL, and every table several tickets read or write, lands in the storage ticket;** owners
  write repository method bodies only. Typed settings and empty repository shells land in wave 0
  with the domain types.
- **Same-wave import check.** For every wave, list the imports between its tickets; each one is
  either a real edge or a shell that must move to an earlier ticket. This is part of the audit, not
  only a pattern: state the result with the critical path. (AEA: wave-0 tickets imported each
  other's types; wave-2 tickets read sibling-owned tables.)
- **Keep the critical path short.** After the audit, state the longest chain and the widest wave.
  If one issue sits on the critical path and is large, split it so the dependents start sooner.

Then write the **collision map** for each wave with more than one ticket: for every file, folder,
schema, fixture, config or document two tickets in the same wave might touch, name one owner or
move one ticket. A shared document that many tickets must append to (a SUBMISSION tracker, a
README section) gets a one-line-per-ticket rule so merges stay trivial. Avoid barrel files on
shared folders; each ticket imports the file it needs.

### 2b. Give every issue its lane

Label each issue with exactly one lane, per the workspace rule `ticket-lanes.md`: `lane::build-loop`
if it changes anything code or tests read (source, tests, schema, loaded prompts or knowledge files,
contracts, config, dependencies, CI, fixtures), whatever the file type; `lane::direct` if one general
agent can do it without touching any of those (docs, trackers, review pages, diagrams, housekeeping);
`lane::human` if only the person can do it; `lane::spike` if its output is a decision record. When
unsure, `lane::build-loop`; a ticket that mixes a doc and the code it describes is split or goes in the
loop whole. A build ticket that only waits on a person keeps `lane::build-loop` and adds `gate::human`.
Non-build tickets are real work but not build work: putting them through the loop adds a worktree,
frozen tests, reviewers and a full-suite merge gate to a Markdown change.

### 2c. Mark security work

Add `risk::security` to a build-loop issue when a bug in it could leak data, grant access, expose a secret or open the system to an attacker: auth and
authorization, secrets, encryption and keys, PII/PHI, untrusted input reaching a model, query, shell or
path, network exposure, deployment config, money. Only these issues get frozen tests first and the
security agent at their wave merge; every other build issue runs plan → implement → test → review
(workspace rule `build-loop-test-scope.md`). Keep it strict: an issue that only displays data is not
security work. But look past the obvious auth tickets: on AEA, 7 issues were labelled at first and 17
after spec writing, the missed ones being model adapters holding provider keys, typed settings
holding secrets, intake parsing that keeps codes and card numbers out of storage, the gateway that
applies redaction before text leaves for a provider, endpoints that return verification codes,
services storing contact details, and the eval harness carrying an eval key and held-out answers.

## 3. Write verification contracts

Each acceptance criterion has an ID unique within its issue (`AC-1`, `AC-2`, …) so the coverage
audit can cite it, and states:

- one observable behaviour, invariant, refusal, regression or failure;
- the exact verification method, such as a named test, command, configuration read-back or live
  check; and
- the evidence a reviewer should see.

Keep each criterion on one line; the checker also accepts indented continuation lines since 2.1.0.

**Presentation work is accepted by presentation examples (`PE-N`), not invented backend worked
pairs.** FW and other presentation-only criteria name a visible, checkable fact: "the primary button
meets 4.5:1 text contrast on the panel in light and dark; its focus ring is visible at 3:1; its
disabled state says so in text", "a status pill shows text and shape for every state", "the
component gallery has 0 serious axe violations", "the gallery at 1280 px matches the look sheet's
palette and radius tokens". A frontend feature ticket also cites the `SCR-N` states it implements
and the `CON-N` errors and recovery paths it renders; its UX-5a evidence (traceability,
accessibility, visual and behavioural checks) is part of its criteria.

Do not use a unit test to prove deployment, CI, permissions or another external fact. Split combined
claims. For validation, logging or trace changes, include a negative criterion proving a distinctive
rejected value is absent from the declared response, logs and trace. Cite the exact source section
or issue; never depend on a local resolver. A criterion that proves a shared component works never
stands in for one that proves a consumer uses it.

Every issue also answers three contract sections, each either filled or `N/A — <reason>`:

- **Observability:** the records this ticket must emit or preserve, for which `WF-n`, and the
  capture evidence (the test that drives the real entry point and finds them, and finds no
  forbidden values).
- **Evaluation:** the evaluation checks this ticket adds or must keep passing, and the
  expected-answer authority for them (who or what decides the right answer, from the evaluation
  plan).
- **Metrics:** the `M-n` from the key-metrics registry the ticket affects, and the acceptance
  condition (the metric stays computable from the emitted records; a target only if approved).

`N/A` needs a reason a reviewer could disagree with ("documentation only; no code path runs").
A ticket that adds or changes an entry point cannot mark Observability `N/A`. End each issue with one `[regression/context]`
criterion naming the project documents the ticket must update (tracker row, design path status,
AI log) so context maintenance is part of done.

## 4. Make each issue a fresh-agent handoff

The issue must stand on its own when the next agent has the repository and issue but none of this
conversation. Carry the full scope of each guarantee into the issue; do not narrow a source's
"every" to one helper or hide a prerequisite in the publication summary. Include:

- a **conventions preamble**, identical on every issue, decided once with the user: repository
  path, the files to read first, the vocabulary source, the workflow gate (plan before build, if
  the project has one), the project's standing refusals, and the test/evidence rules;
- the delivered behavior and the explicit boundary or refusal that prevents an overbroad build;
- exact links or section/requirement IDs for the authoritative product, design and test sources,
  plus the project's conformance check against its brief, answered in one line;
- the owning area, contracts/interfaces and shared surfaces the agent must preserve or coordinate,
  naming which other issues consume what this one produces;
- blockers, dependency wave and any external or human gate, with `None` stated where applicable;
- criteria that name the verification method and expected evidence, including relevant negative
  and cross-issue checks.

Keep this bounded: cite source sections instead of pasting whole documents or speculative file
lists. Then read a ready issue and a later-wave issue as a fresh agent would: can the project's
planner or implementer find the governing contract, know what is excluded, identify its
prerequisites and prove completion without recovering this chat? Repair any missing context. This
read is a semantic spot check; the structural audit below covers every issue.

## 4a. Coverage audit — every requirement, every workflow, every ticket

Before showing the breakdown, write the coverage audit (`templates/coverage-audit.md`; format and
findings in `references/coverage-audit.md`):

```
requirement → workflow / entry point → component / contract → implementing ticket
            → integration owner → acceptance criterion → evidence
```

1. List every mandatory requirement from the governing sources, evaluation, observability and
   metric obligations included, with the workflows each applies to (`all`, or `WF-n` ids with
   reasoned exclusions).
2. Write one matrix row per requirement × workflow.
3. Put every drafted issue in one scratch file (`## [PREFIX-NN] title` + body) and run
   `python3 scripts/coverage_audit.py check <audit> --tickets <drafts> --workflows <observability
   contract>`. It checks the whole set, and flags missing consumers, unowned integration, narrowed
   guarantees, component-only criteria, missing real dependencies, unregistered entry points and
   unjustified N/A.
4. Repair the tickets, not the audit: add the integration ticket or criterion, restore the source's
   scope, add the blocking edge. Re-run until it passes, then do the human review its reference
   lists (completeness of the requirement list and registry, truth of exclusions and N/A reasons).

Re-run the parallelism audit after repairs: an added integration ticket depends only on the
component it wires in.

Run step 1, the requirements sweep, at the design gate (zero-to-hero §6) as well, not only here: it
is what finds unregistered entry points (AEA: the demo login had no `WF-n`) and metrics no workflow
inherits, while the design can still absorb them. A requirement that says every/all/each/never/no
is written `WF-n only — <reason>` or `all; excludes WF-n (reason)`, never as a plain `WF-1`
(`references/coverage-audit.md`).

## 4b. Resolve open items by topic

*Runs before §4a's checker whenever the specs carry `needs-decision` items; it sits after §4a only so the section numbers other skills cite stay stable.*

Spec writers mark a gap `needs-decision` instead of inventing an answer. Then resolve the gaps by
topic, in parallel:

1. **Sweep.** One fast evidence sweep per topic (Haiku) lists each open item and quotes the source
   passages that bear on it.
2. **Resolve.** One Opus resolver per topic owns that topic's types (a type is defined only by the
   topic that owns its module) and writes its own contract-addendum file and decision ledger,
   sorting every item into *settled by source* (quoted), *engineering default* (labelled `[A]`,
   with the measurement that will replace it) or *Innocent's* (a story-first decision request,
   workspace rule `decision-requests-story-driven.md`).
3. **Merge.** Merge the addenda and check every cross-topic assumption against the topic that owns
   it.
4. **Reconcile.** Reconcile agents update the ticket specs from the merged addenda.

Consistency comes from ownership, not from serialising, **but only for types one topic owns**.
On AEA (2026-10-21) eight parallel resolvers each defined the shapes two topics both touch (the
login session, `TurnContext`, `GraphOutcome`, the metrics reader) and produced 28 clashes that took
a merge round and a cross-reference round to repair. So add a step 0: **one agent first writes the
shared kernel**, every type and signature that more than one topic uses, with its single owner and
exact spelling (`docs/design/contracts/stage7/kernel.md`). The topic resolvers then fan out around
that fixed kernel and may not redefine anything in it; a cross-topic need goes back to the kernel
agent. The better fix is upstream: the contracts (DO-4) are design, so they are written complete in
one coherent pass at Stage 6 (zero-to-hero §6 signature check); parallelism belongs to the work
that follows. In particular, never fan out the *design* of contracts across agents.
Most such gaps should have been caught at the design gate (zero-to-hero §6
signature-completeness check); a long open-items list here is a finding against that gate.

## 5. Confirm the breakdown

Show the proposed issues with title, kind, blockers, delivered behaviour, shared surfaces, wave, lane and gate,
the lane split (for example "31 build-loop, 6 direct, 3 human, 1 spike"), the kind split (backend /
frontend / integration / foundation), each ready ticket's `ticket_readiness.py` result and the `risk::security` count,
then the parallelism audit's result (critical path length, widest wave, the edges removed and
why), the collision map, and the coverage audit's result (tickets checked, findings repaired, and
the items left for human review). Ask whether granularity, dependencies and parallelism are correct,
then revise until approved.

## 6. Publish directly to GitLab

Create issues in dependency order so blocker references resolve. GitLab is the authoritative record;
do not create a local ticket mirror or ledger. Label each issue with `slice::<Sn>` (the source's
slice or area), `wave::<n>`, one `kind::backend` / `kind::frontend` / `kind::integration` / `kind::foundation` on implementation issues (§0), exactly one `lane::build-loop` / `lane::direct` / `lane::human` / `lane::spike` (§2b), `risk::security` where §2c applies, and any `gate::human` / `gate::live` / `gate::paid` / `gate::design` / `gate::<host>`;
mark optional scope `cuttable`. Create the labels first if they do not exist. Use native blocking
relationships when available; otherwise add `relates_to` links from each issue to its blockers and
keep the authoritative blocker list in the body. Do not modify or close a parent issue unless the
user asks. Title format: `[<prefix>-NN] <slice>: <behaviour>` so ordering survives sorting. When a ticket is split, the new half takes the next free number; a letter suffix (`S-15a`) is not a ticket ID to `coverage_audit.py`, which then folds that section into the ticket above it (HouseAccount, 2026-10-20).

Recommended issue body:

```markdown
_Conventions for every <project> issue (from the approved breakdown):_ <repository path>; read
<entry, router, rules> first; <vocabulary source>. <Workflow gate sentence, if any>. Never: <the
project's standing refusals>. <Test and evidence rules>.

### What to build
<the end-to-end behaviour, including the contract names other issues will consume>

### Source
- <exact PRD/design/test sections or parent issue>
- <router row / tracker rows this issue touches>
- **Brief check:** serves "<quoted sentence>"; touches nothing out of scope; weakens nothing → proceed.

### Acceptance criteria
- [ ] AC-1 [invariant] <claim> — verify: <test or check> — evidence: <expected result>
- [ ] AC-2 [failure/refusal] <claim> — verify: <test or check> — evidence: <expected result>
- [ ] AC-3 [negative] <rejected value absent from response/log/trace> — verify: … — evidence: …
- [ ] AC-4 [capture] <required records present at WF-n's real entry point> — verify: … — evidence: …
- [ ] AC-5 [regression/context] <documents updated in the same change> — verify: diff — evidence: diff

### Observability
- Responsibilities: <records emitted or preserved, for WF-n, per the observability contract>
- Capture evidence: <the AC that drives the real entry point and finds them>
<or: N/A — <reason>>

### Evaluation
- Checks: <suites or cases added or kept passing>
- Expected-answer authority: <who or what decides the right answer, from the evaluation plan>
<or: N/A — <reason>>

### Metrics
- References: <M-n from the key-metrics registry>
- Acceptance conditions: <metric stays computable from the records; target only if approved>
<or: N/A — <reason>>

### Blocked by
<issue links or None>

### Agent handoff
- Area / owner: <project route or area>
- Contracts and shared surfaces: <what it consumes, what it produces and for whom, what it must not edit>
- Scope boundary / refusal: <the material exclusion, or None>
- Wave and gates: <wave number; human, external, paid or planning gate, or None>
- Kind: <backend | frontend | integration | foundation — and the CON-N / SCR-N it rests on, with their status (§0)>
- Lane: <build-loop | direct | human | spike — one line on why (ticket-lanes)>
- Risk: <security — what a bug here could leak or open (§2c), or None>
- Entry points added or changed: <WF-n from the observability contract, or None>
```

Avoid speculative file lists and code snippets unless a small prototype encodes a decision more
precisely than prose.

After publishing, update the project's context in the same session: the router row that turns
work into tickets, the setup profile's reuse decision for this skill, the progress checklist, and
the entry point's current state. Keep the coverage audit file where the project keeps plans and
replace draft ticket numbers with the published ones. GitLab owns status from then on.

## Implementation handoff

Only `lane::build-loop` issues enter the build handoff below. A `lane::direct` issue is done by one
general agent alongside its wave, with no plan file, frozen tests, reviewers or merge-gate suite; a
`lane::human` issue gets exact steps for the person; a `lane::spike` issue follows the project's spike
procedure (rule `ticket-lanes.md`).

Follow the target project's handoff. If it requires `plan-ticket` or `plan-batch` before
`execute-batch`, dependency-ready issues are planning inputs, not permission to start builders;
the required plan supplies concrete files, risks and checks, and the batch plan may refine the
declared waves further (Equinox's batch plan re-waved 16 issues into 9 after reading the code). If
the project uses a lean direct path, implement a ready issue from the checkout and issue, run
focused tests, review the diff once and update the issue with evidence. In either path, run the
broad suite and cross-issue checks on the combined integration or release candidate.

**Plans reconcile; they do not just copy.** Whatever the project's planning chain, a per-ticket
plan meets `templates/implementation-plan.md`: it opens every governing source (requirements,
component contracts, evaluation plan, observability contract, key-metrics registry), lists every
obligation they place on this ticket's workflows and components, and gives each a disposition:
already in the ticket (`AC-n`), `added` by the plan (and proposed to the issue as a comment),
owned by another named ticket, `needs-decision` or `blocked-on`. Preserving the issue's criteria
verbatim is still right; treating them as the whole contract is not. The plan also registers every
entry point or experiment it adds before building it. Check a plan with
`python3 scripts/coverage_audit.py check-plan <plan> --workflows <observability contract>`.
A project chain that predates this contract adopts it when its owner next edits that chain.

**Implementation verification is the last gate.** When the integration candidate is green, fill
each coverage-matrix row's evidence with `verified: <link or run>` and run the audit with
`--stage verify` against the exported issues. A passing unit test of a shared component does not
verify a row whose workflow never calls it.
