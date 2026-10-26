# Name scan: the three-word residual (2026-10-26)

Recorded by slice F2 (contract consistency follow-up, handoff section 2). No detection change was made.

**Words.** `Length`, `Preference`, `Describes`.

**Context.** The first capitalised word after a stripped rationale label (`B. Incorrect: <Word> ...`) in a CFU
rationale, absent from every source, with no lowercase occurrence in the lesson's own fields or the sources. The
tagger (`compromise`) has the word in no name lexicon and tags it like `Medusa`, so the scan cannot tell them apart.

**Evidence.**
- Commit `6cc5e07`, test `names_after_labels`: the lesson's own lowercase use clears all three; with none, `Length` is flagged.
- `packages/core/src/checks/rules/grounding/name-scan-residual.test.ts` pins the behaviour as a documented limitation.
- Replay `docs/testing/error-analysis/replay-2026-10-26.md`: `proper_noun_unsourced` in 0 of 47 final drafts and 1 of 47
  initial drafts. Which word that was is **not recorded**; the corrected replay that prints `matched` (handoff
  section 3 item 4) will add it.

**False positive and missed name in the same position.** `Length` is a false positive; `Medusa`, `Brindle` and
`Quillon` are real invented names that must stay caught. The classes coincide, so any exemption by word class would
let an invented name through.

**Policy.**
- Keep blocking where the checker blocks today (CFU choices).
- No whitelist and no downgrade by word class.
- Generation: the finding carries the exact word in `matched`, so repair is told which word to fix.
- Review: the finding is resolvable (`NON_RESOLVABLE` does not contain `proper_noun_unsourced`) by a named person's
  recorded resolution.

**Reassessment of blocking impact.** Measured on the only stored run: 0 final drafts blocked by it. A severity change
is not warranted by that number. Reopen if a real run's final drafts show any of the three words blocking, and record
the count then.

**Not covered.** Names later in a sentence; the existing `surface-forms` and `name-scan` tests cover them.
