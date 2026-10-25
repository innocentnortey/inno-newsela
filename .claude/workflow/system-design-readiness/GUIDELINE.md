# How to Do a System Design — the Gauntlet Guideline

This is the process to follow whenever a Gauntlet project needs a system design. It was distilled on
2026-10-08 from a ChatGPT conversation (`prep/2026-10-08-requirements-driven-system-design-process.md`),
which was itself built from a cohort session on how system design works at scale
(`transcripts/2026-10-08-system-design.md`). The readiness checklist that goes with it is
`CHECKLIST.md` in this folder. The principles under it, each with questions to raise in the design
conversation, are `principles/system-design.md` (GP-107 – GP-119).

---

## The whole idea in one line

> **What must the system accomplish → what work does that create → what resources does that work
> consume → what design meets those needs within our limits?**

A design you can defend is one where you can follow any component back along that chain. Gauntlet
grades whether you can defend what you built, so if a component can't be traced back to a
requirement, the design isn't finished.

---

## The four kinds of fact

Every number or statement in a design is one of four kinds. Keep them visibly separate, because an
LLM conversation will turn a plausible assumption into an apparent fact within three messages.

| Kind | What it is | Example | If it's missing |
|---|---|---|---|
| **Target** | A promise you choose to make | "95% of routing requests finish in 250 ms" | Decide it. Record why. |
| **Assumption** | A stand-in for something not yet known | "Each user makes 10 requests a day" | Label it. Name the test that will replace it. |
| **Calculation** | Something derived from targets and assumptions | "≈139 requests/second at peak" | Show the arithmetic. It is only as good as its inputs. |
| **Measurement** | Something observed from running code | "p95 was 410 ms at 50 virtual users" | Run the benchmark. Never write a measurement you didn't take. |

The readiness checklist adds a fifth tag, **Issued**: a fact only the assignment, the hiring partner
or Gauntlet staff can supply. Issued facts are never assumed. If they are missing, you go and find
them before designing.

---

## The eight steps

Do them in order on the first pass, then loop back. A benchmark in step 8 may change a number from
step 3, and the cost in step 7 may force a different freshness target in step 2. That's expected.

| # | Step | The question | What you write down |
|---|---|---|---|
| 1 | **Frame the problem** | Who is trying to do what, within what limits, and what is the hardest thing to get right? | Outcome, constraints, the hardest uncertainty |
| 2 | **Make measurable promises** | What does "good enough" mean for each important operation? | A table of correctness, latency, freshness, availability and recovery targets |
| 3 | **Model the workload** | How much work arrives, of what kind, and when? | Request classes, volumes, peak and burst, background work |
| 4 | **Sketch the logical flow** | What happens inside the system to complete one operation? | One operation traced end to end, with who owns each record |
| 5 | **Estimate resource demand** | Which resource does that work use up first? | CPU, database, model, network and storage estimates, plus a guess at the first bottleneck |
| 6 | **Decide overload and failure behaviour** | What happens when more work arrives than you can finish, or a dependency fails? | A policy per operation: wait, defer, degrade, throttle or fail fast |
| 7 | **Choose the smallest deployment that fits** | What is the least you can run that still keeps the promises? | Deployment, cost model, and a reason for every component |
| 8 | **Validate and revise** | What evidence shows the design actually works? | Benchmarks, evals, failure tests, and what would trigger a redesign |

### Set the depth before you start

Step 1's **hardest uncertainty** decides how deep the other steps go. Not every Gauntlet project is
a scale problem. Zach Gardner, on the PEAK6 brief: "They know the web problem is solvable"
[00:28:15] … "So prove that it is possible" [00:28:49]. And on picking a scale: "if you don't know
which bucket you're designing for, … you're going to design a system that too complicated to
maintain and too expensive to keep" [00:15:05].

- **Equinox** (a CLI/library with a thin operator UI on Railway since PRD 0.5, which superseded
  D7's "hosting dropped"). The hard part is whether two contracts are really
  equivalent and whether routing is deterministic. Steps 2, 4, 6 and 8 go deep. Steps 3, 5 and 7
  only need you to state the workload assumption and benchmark the router once.
- **AgentForge** (an AI co-pilot inside OpenEMR, with a 50-user load test). Model latency and what
  the legacy system can handle are central, so steps 3, 5 and 7 go deep too.

Write the depth down: each step is **full**, **light** (state the answer in a sentence or two) or
**n/a** (with the reason). A skipped step with a reason can be defended. A step that's silently
missing can't.

---

## Observability across the steps

Observability is not a step-8 afterthought. Each step decides part of what the running system must
show, and step 8 checks that it was captured. Keep two questions apart throughout: **did it run**
(operational success, latency, errors) and **was it right** (correctness, measured by evals and
review). A green trace only answers the first (GP-58).

| Step | What it decides about observability | Items |
|---|---|---|
| 1 Frame | What may be recorded raw, redacted or never; who may read it; retention; what may leave the environment | SD-1.8, SD-1.10 |
| 2 Promises | What counts as operational success for each operation, kept apart from output quality | SD-2.7, SD-2.8 |
| 3 Workload | Which workload classes and volumes to count, including background work; every workflow and entry point that must be covered, experiments and operator scripts included | SD-3.1 – SD-3.7 |
| 4 Logical flow | The stages one run passes through, where it waits or queues, and the boundaries to time under one run ID | SD-4.3, SD-4.7 |
| 5 Resource demand | Time and resource use per stage; for model calls, tokens and cost per successful outcome | SD-5.1 – SD-5.3 |
| 6 Overload and failure | The signal that each failure policy fired, and the signal that recovery happened | SD-6.3, SD-6.5, SD-6.6 |
| 7 Deployment | Where telemetry lives and who can operate it, chosen from the constraints, with no default tool | SD-7.5, SD-7.6 |
| 8 Validation | What is captured while it runs; for models and agents, what one run's trace holds; which measurement triggers a redesign | SD-8.4, SD-8.6, SD-8.7 |

For systems with a model or an agent, one run must be reconstructable from its trace: its steps,
what each model saw and produced, versions, tool calls, failures, latency, tokens and cost
(GP-56, GP-57). A system with no model needs none of that, and a single local process may need
only structured logs keyed by a run ID. LangSmith, Langfuse, OpenTelemetry and hosted backends are
options to justify against the constraints (GP-60, GP-63), not requirements.

### Evaluation and metrics travel the same way

"Was it right?" and "which numbers decide what?" are settled as inputs too, not left to whoever
writes the tickets. Step 2 names the key metrics, the decision each informs and its population
(SD-2.9). Step 3 lists every workflow, so no background job or experiment escapes coverage
(SD-3.7). Step 8 names who decides a correct answer and where each case comes from (SD-8.8), and
which cases are held out (SD-8.9).

The design then turns those inputs into three of its seven required outputs
(`DESIGN-OUTPUTS.md`): the **evaluation plan** (DO-5), the **observability contract** (DO-6) and
the **key-metrics registry** (DO-7). Each has a minimum content a checker can verify, an owner and
a location, so the tickets can trace every mandatory requirement through them.

---

## A worked example of steps 3 → 5 → 7

These numbers come from the cohort's Gemini sizing chat after ChatGPT corrected them. They are
illustrative, not requirements for any project.

**Input (assumptions):** 60,000 daily active users, 10 requests each a day, a 20× peak, 250 ms mean
time in the system.

**Process:**

1. 60,000 × 10 = **600,000 requests a day**.
2. 600,000 ÷ 86,400 seconds = **6.9 requests a second** on average.
3. × 20 peak = **≈139 requests a second** at the modelled peak.
4. Little's Law (average requests in progress = arrival rate × average time each one spends in the
   system): 139 × 0.25 s = **≈35 requests in progress at once, on average**.

**What that does *not* tell you:** how many servers you need. Two requests that both take 250 ms
can cost very different amounts:

| What the request does | CPU needed at 140 requests/s |
|---|---:|
| 5 ms of CPU, then waits on the database or model | 0.7 CPU-seconds per second (less than one core) |
| 250 ms of real CPU work | 35 CPU-seconds per second (35 cores) |

The same reasoning applies to database connections. Holding a connection for 20 ms means about 3 in
use at any moment; holding it for 200 ms means about 28.

**Output (step 7):** suppose a benchmark shows one replica handles 80 requests/s within its targets,
and the requirement is to keep serving 140 requests/s when one replica dies. Two replicas give 160
requests/s, but only 80 after a failure. Three replicas give 160 after a failure. **That is the
defensible reason for three**, and it only holds if the database and the model provider can also
sustain 140 requests/s.

This is the point Innocent raised in the cohort session: "you're not even factoring in what's going
on in your actual architecture" [00:44:24]. You can't size a system from user counts without knowing
what each request actually does, so step 4 has to come before step 5. It also explains why OpenEMR
failed at 50 users while a sizing sheet claims 30,000 users on a few replicas [00:47:06–00:47:34].
Fifty users each holding a slow request can use up every worker, connection or model slot, even
when CPU is nearly idle. The session settled it as "just a concurrency problem" [00:49:10]. The
question to ask is: **what resource is held, for how long, and how many requests can hold it at
once?**

---

## Rules of thumb worth keeping

- **Fast and fresh are different promises.** A reply can arrive in 100 ms while quoting
  five-minute-old data. Measure latency and freshness separately.
- **Correctness rules are invariants, not percentages.** "Never simulate an unaccepted fill" can't
  be hidden inside "99% of requests succeed". It holds every time or it's a bug.
- **A queue absorbs a burst. It does not add capacity.** If workers finish 140 jobs/s and 100 keep
  arriving, only 40/s are left over to clear a backlog. An 80-job backlog takes about 2 seconds, not
  0.6.
- **Autoscaling helps with spikes that last longer than it takes to start new capacity.** For short
  bursts, keep spare capacity ready and limit how much work you accept.
- **CAP (when the network splits, you can't have both fully consistent data and an answer from every
  node) is decided per operation, not per system.** Browsing can serve labelled stale data while
  routing refuses to act on untrustworthy liquidity.
- **Replicas, availability zones and regions solve different problems:** capacity or losing one
  replica, losing one data centre, and geography or regional recovery. Request volume alone never
  forces a second region.
- **For AI systems, count cost per successful outcome:** every model call, retry, tool call and
  background job it took to produce one useful answer.
- **Finding candidates and proving they qualify are separate jobs.** Similarity search finds
  contracts worth comparing. Your rules decide whether they're actually equivalent.

---

## The sentence every major decision has to complete

> **Because** [a specific requirement or measured limit], **we chose** [design], **at the cost of**
> [latency / money / reliability / complexity]. **It should give** [a measurable result]. **We will
> verify it with** [test], **and revisit it when** [trigger].

The "at the cost of" clause comes from GP-30 (every option has a trade-off; naming it is what reads
as senior), which `design-doc-defense.md` already requires. The rest of the sentence is from the
ChatGPT conversation.

---

## What the finished design brief contains

1. **Outcome and scope:** what it must do and prove; what's ruled out.
2. **Constraints:** deadline, budget, required systems, external limits.
3. **Promises:** correctness invariants, latency, freshness, availability, recovery.
4. **Workload model:** request classes, background work, the expected case and the stress cases.
5. **Logical design:** one important flow traced end to end; who owns each record; every place a
   model makes a decision.
6. **Capacity and cost:** demand calculated from the stated assumptions and measured per-request
   costs.
7. **Trade-offs:** the decision sentence for each major component.
8. **Evidence:** benchmarks, evals, traces, failure tests, open questions.
9. **Observability:** what is recorded and under which policy, the run and stage structure that is
   traced, the operational and quality signals kept apart, where telemetry lives and why.

Items 1–8 are the **system design** (DO-1). The design is not complete until the other six
required outputs exist too (`DESIGN-OUTPUTS.md`): architecture (DO-2), code design (DO-3),
component contracts with every consumer named (DO-4), the evaluation plan (DO-5), the
observability contract (DO-6, which item 9 summarises) and the key-metrics registry (DO-7).

In a Gauntlet build repo these sections normally live in `ARCHITECTURE.md`, `KEY_METRICS.md` and the
requirements doc, so write each section into whichever of those owns it rather than starting a
parallel document. A small project may keep all seven outputs as named sections of one document;
the register records where each one is.

---

## Sources

- **Cohort session, 2026-10-08** (`transcripts/2026-10-08-system-design.md`, 51 min; Zach Gardner
  led, with Innocent, Kaushal and Sefath). The recording starts and ends mid-sentence, and speaker
  labels for "Sefath" after [00:27:42] are unreliable. Lines used here:
  - Economics first: Zach [00:12:38], "this is step 1"; Kaushal [00:12:20], "what services you
    could afford with that margin level".
  - Picking a scale: Zach [00:15:05].
  - Multi-region is about availability, not load: Zach [00:17:12], "You do not need it to actually
    handle your load."
  - CAP: Zach [00:20:39], "the underpinning of every single system design you will ever make".
  - Prove the uncertain part: Zach [00:28:15], [00:28:49].
  - Fix what breaks first: Zach [00:46:19].
  - Innocent's objections: [00:43:29], [00:44:24], [00:47:06–00:47:34].
- **ChatGPT conversation, 2026-10-08** (`prep/2026-10-08-requirements-driven-system-design-process.md`):
  the 8 steps, the worked numbers, the rules of thumb and the decision sentence. ChatGPT corrected
  several of the Gemini sizing chat's numbers and claims (users vs. requests per day, 87 in flight
  vs. 87 per second, CAP as a whole-system choice). The corrected versions are used here.
- **Gauntlet principles:** GP-30, the "what this costs us" clause (`principles/architecture-and-tradeoffs.md`).
  GP-2/3, listing every model decision (via `design-doc-defense.md`).
  GP-22/23 and GP-56 – GP-63, observability across the steps (`principles/evals-and-observability.md`,
  `principles/observability-in-practice.md`).
