---
name: prd-interview
description: Run or resume a staged, adaptive PRD interview kept in one living Markdown document inside the target project. Reads existing documents first and carries settled answers with citations, asks one stage and at most four questions per turn, gives every system-design-readiness checklist item an explicit disposition, records the owner and location of the seven required design outputs, reconciles each answer into the document that owns it, and stops at explicit PRD approval and a design handoff. Use when requirements are unclear, high-stakes or incomplete, when a PRD draft needs a structured review interview, or to resume an interview from its document.
disable-model-invocation: true
---

# PRD Interview

Version 2.1.0, 2026-10-11 (2.0.0, 2026-10-08).

**What it does.** It interviews the user in small batches until the product requirements and the
inputs a system design needs are settled. The interview lives in one Markdown document inside the
target project. That document holds the stage map, every question with a stable ID, the answers
and their history, the evidence, checklist coverage and the next batch. Any later session resumes
from that file without the chat history.

**What it is not.** It is not another PRD, a ticket ledger or a workflow engine. Requirements stay
in the PRD, decisions in the project's decision record, and design inputs in the requirements doc
or readiness report. The interview document records each question and points to where its answer
landed.

| File | Job |
|---|---|
| `references/interview-document.md` | Document format: sections, question fields, statuses, dispositions, answer history, completion gate |
| `references/stage-map.md` | Default stages (the guideline's eight steps), checklist-to-stage mapping, depth, promoting provisional questions, batching |
| `references/observability.md` | The observability thread: questions per stage, model and agent run traces, telemetry policy, where answers go at handoff |
| `references/design-outputs.md` | The seven required design outputs: what the interview settles for each, and what it leaves to design |
| `templates/interview.md` | The starting document |
| `checklists/` | Optional question packs (`generic-prd`, `ai-agent-app`, `agentforge`); format in `references/pack-format.md` |
| `scripts/interview.py` | Read-only: prints the full coverage table, checks a document and its completion gate |
| `../system-design-readiness/CHECKLIST.md` | The coverage floor. Every item gets a disposition |
| `../system-design-readiness/DESIGN-OUTPUTS.md` | The seven required design outputs and the four gates; `interview.py` uses its checker |

## 1. Find the work home and the document

Establish the target project first; the skill's own location is not the target. Read the target's
entry instructions (`CLAUDE.md`, router, setup profile) for its source ranking, document locations
and current owners. Then pick the document location in this order:

1. A path the user gives.
2. A location the project already records for interview or decision records.
3. An existing interview document for the same scope. Resume it; never start a second one.
4. Next to the PRD: `<prd-dir>/<scope>-interview.md`. With no PRD yet, `docs/<scope>-interview.md`.

If two of these conflict, ask once. Record the chosen path in the document header. If the project
has a router or setup profile owned by someone else, propose the link to them rather than editing
their file.

If the readiness checklist or `DESIGN-OUTPUTS.md` is not beside this skill (a copied install), ask
for its location. Never drop coverage because the file is missing.

## 2. Setup: read before asking

1. Sweep the sources. Read the issued brief or assignment, any PRD draft, decision records, open
   questions, requirements, users, metrics, architecture and submission documents that exist.
   Record each in **Sources read** with its authority and the revision or date read. For a large
   project, give the sweep to a subagent along with the checklist and keep only the filled
   coverage.
2. Create the document from `templates/interview.md`. Fill the **Artifact map** with the existing
   or intended location of every downstream artifact (see step 8). Fill its **Design outputs**
   register: one row per required output (system design, architecture, code design, component
   contracts, evaluation plan, observability contract, key-metrics registry) with owner,
   location and the sources that feed it (`references/design-outputs.md`). Mark unknown
   locations `unknown — ask` and ask about them in the first batch.
3. Paste the output of `python3 scripts/interview.py skeleton` into **Checklist coverage**. Give
   every row a disposition from the sweep: `answered` with a citation, `needs-decision`,
   `needs-research`, `assumed` with a measurement plan (Measure items only) or `n/a` with a reason.
4. Choose the lightest question pack that fits, if any. Add the project's own questions as well:
   anything the brief, the domain or the existing documents raise that neither the pack nor the
   checklist names. Keep them. They are `Sources: project`.
5. Write the **Stage map** (`references/stage-map.md`). Stages S1–S8 are the eight steps of
   `system-design-readiness/GUIDELINE.md`, the framework for every design input. Prepare S1, and
   S2 when S1 leaves it unambiguous, with concrete questions. Give later stages their topics,
   checklist items, dependencies and provisional questions.
6. Fill the **Observability map**: one row per stage, from `references/observability.md`. Carry
   known answers with citations; mark the rest with their dispositions; draft each stage's
   observability questions with `Thread: observability`. The AI parts apply only when a model or
   agent is involved.
7. Mark questions a source already settles as `carried`, with the citation. Do not ask them again.
8. Run `python3 scripts/interview.py check <doc>` and fix every structural error.
9. Tell the user what the sweep settled, what is open by stage, and the first batch.

## 3. Ask in batches

- Ask from one stage per turn, at most four questions. Show that stage's carried answers as a short
  review list beside them.
- For a decision, explain the concept in two or three sentences, then offer 2–4 concrete options
  with a recommendation the user can pick or remix.
- Graded, required or high-stakes questions get no default. A low-stakes question may carry a
  labelled proposed default.
- Never ask for a fact a source already establishes. Never fill an issued or external gap with a
  plausible guess; mark it `needs-research` and say whom to ask or where to look.
- Ask each stage's observability questions inside that stage, not as one tracing question at the
  end. Keep "did it run" (operational success) and "was it right" (correctness) in separate
  questions. Assume no tracing tool, hosted backend or multi-agent design; the project's
  constraints choose.
- Ask the evaluation and metrics questions where they belong too: who decides a correct answer
  and where cases come from (SD-8.8), what is held out (SD-8.9), which decisions each key metric
  informs and over what population (SD-2.9), and every workflow that must be covered, experiments
  and operator scripts included (SD-3.7). Assume no numerical target; a target is either approved
  by the user or the metric is measurement-only.
- Keep the layers apart. The interview settles product questions and design inputs: purposes,
  promises, policies and decisions. When an answer turns to how to build it, record it as a
  `design` question, mark it `deferred` to the design output that owns it, and move on.

## 4. After each batch

1. Record each answer in its question: `Answer`, `Evidence` (batch and date, or the decision
   entry), `Decision`, `Affects`, and a History line. Update the coverage rows and Observability
   map rows it closes.
2. State the consequential inference in one sentence so the user can correct it cheaply. Write it
   in the batch log too.
3. Reconcile the owners in the same turn. Decisions go in the decision record. Requirement changes
   go into the PRD draft as unapproved revisions. Unknowns go to the project's open-questions
   list. Design inputs go to the requirements doc or readiness report. If another person or
   session owns a document, do not edit it: queue the exact change in the batch log, naming that
   owner.
4. Refine downstream: promote provisional questions whose dependencies are now answered, retire
   moot ones, add new ones the answers exposed, and update stage depth and state.
5. Update **Next batch** and **Resume here**. Run the checker.

## 5. When an answer changes

Keep the old answer in History, and replace only the current answer. Mark every question that
depends on it `revisit`. Name the coverage rows and owner sections that drew on it. Reconcile or
queue those owners. A `revisit` question blocks completion until it is re-confirmed or changed
(`references/interview-document.md` → *Answer changes*).

## 6. Resume

Read **Resume here**, then **Next batch**. A document created before v2.1.0 has no *Design
outputs* register, and the checker now reports it missing: add the seven rows under the Artifact
map on resume, fill what the sources settle, and ask about the rest in the next batch. Check **Sources read**: if a source changed since its
recorded revision or date, re-sweep it and mark affected carried or answered items `revisit`.
Then ask the next batch. Do not restart setup, and do not re-ask settled questions because the
chat is new.

## 7. Complete, approve, hand off

The interview is complete only when the gate in `references/interview-document.md` holds. Every
question, checklist item and Observability map row has a justified disposition, decisions are resolved, needed external
facts are cited with dates, remaining assumptions have measurement plans, and every required
design output has an owner, a known location and sources (or a justified `n/a`). Answered
questions never stand in for a missing output record. Run
`python3 scripts/interview.py check <doc> --complete`. Never declare completion, and never write a
measurement that wasn't taken, while an issued or external fact is still missing.

Then, in the S9 Close stage:

1. **Approval.** Present the revised PRD, or a summary of every revision with links, and ask for
   explicit approval. Record it in **Resume here** and in the PRD, following the project's
   convention. Until then the PRD remains a draft, however complete the interview.
2. **Readiness.** Run `system-design-readiness`. It reads this document first and reuses its
   coverage rather than re-interviewing.
3. **Handoff.** On a READY verdict, hand off along the **Design outputs** register:
   system-design reasoning → architecture (responsibilities and semantic contracts) → code design
   (modules and exact contracts) and component contracts, with the evaluation plan, observability
   contract and key-metrics registry filled alongside → implementation planning. Each step writes
   into the location the register names and moves its row's status. Interview completion, design
   readiness and ticket readiness are separate gates (`DESIGN-OUTPUTS.md` → *Four gates*); none
   implies the next. The observability answers travel the same path: policy and signals into the
   system design, emitting components and run-ID propagation into architecture, exact fields and
   redaction into code design, and capture evidence into the plan
   (`references/observability.md` → *Where the answers go*).

Stop there. Do not create tickets or implement anything unless the user asks for that step.

## Rules

- One living document per scope. Update it in place; History is append-only.
- Owners own. The interview document records and links; it never becomes a parallel PRD.
- Every readiness checklist item and every question has an explicit disposition. No silent
  omissions.
- Provisional questions and proposed defaults are never written into an owner as requirements.
- Targets, assumptions, calculations and measurements stay visibly separate.
- Preserve concurrent work. Inspect a shared document's current contents before changing it, and
  leave other owners' files to them.

## Legacy helper

`scripts/bridge.py` registers a PRD in a tdd-swarm `HANDOFFS.md` ledger. That engine is retired,
and this workflow does not use the helper. See `README.md`.
