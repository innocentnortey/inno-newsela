# Astra slice D: part contract, per-code standards evidence, slot obligations (2026-10-26)

**Changed.** Exact `Part A`/`Part B` canonical (template lists them, prompt states them, compiler maps descriptive labels deterministically and records `part_remaps`). Standard codes travel as bracket tags on routine, Pulse Check and Quick Write headings (`compile/standard-tags.ts`). `standard_not_taught` and `standard_not_checked` are per code; one assessment item covers at most two codes. Front matter origin comes from the row: a tagged leaf of a listed parent is `narrowed` (replaces the parent, open confirmation, generator), any other unlisted tagged code is `added`. `code_not_allowed` accepts row-listed parents and blocks unknown tagged codes; its generation suppression is removed. A required excerpt slot that was never created (applied writer task, or incoming homework link) is blocking `section_missing`; an absent target slot blocks `cross_lesson_link`. Open slots remain successful draft outcomes.

**Why.** The audit found 23/30 stored-ready lessons raising `code_not_allowed`, generic teaching text satisfying every focus code, and missing slots counted as success.

**Checked.** Unit tests, S1/S2 golden 100%, worker int tests; no model calls. Nothing was re-measured with a model, and no alignment is verified by a person or a judge (links stay `confirmed_by: null`). Editing `lesson-shape.md` changes `locked_hash`: a new prompt version at next start (NL-134 rerun rule applies).

**Remaining.** `evals/cases/drafts/_fixtures/good-wp-3.json` needs a tagged Learning in Action routine (RL.6.7, added) or the stub WP-3 case fails `standard_not_taught`; narrowing is not offered by the prompt yet (R-D4); proposed S3 changes (location checks, WP-1 `checked_in` Look Back) need a recorded contract correction.

## Follow-up: stub WP-3 fixture tagged (2026-10-26, replay session)

**Changed.** `evals/cases/drafts/_fixtures/good-wp-3.json` only: the Learning in Action `routine_heading` ("Meaning-Making Huddle") now carries `standard_codes: ["RL.6.7"]`, `code_origins: ["added"]`. Not touched: any `expected.json`, `bad-draft.json`, the 1.0 floor, any assertion.

**Why.** The WP-3 outline row lists no focus codes, so the cited RL.6.7 is recorded `added`. The new contract (`docs/delivery/2026-10-26-astra-fix-handoff.md`, "Align production lesson structure") requires per-code teaching evidence: an `added` code needs a tagged teaching routine. The stub good draft had only a tagged CFU item, so `stub_wp3_passes_all_assertions` failed with `standard_not_taught`. The fixture is a hand-written stub good draft, so aligning it with the contract does not weaken any check.

**Checked.** `git diff --stat -- evals/cases` shows only this fixture; the `expected.json` hashes the S3 int test compares are unchanged. S3 tests re-run after commit (see the replay devlog).
