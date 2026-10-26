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

## Second limit: missed names read as ordinary words (added 2026-10-26, review follow-up)

This is a **missed-name** limit, the opposite error to the three false positives above. It is recorded as a limit,
not fixed; detection is unchanged.

**Words probed (first word after a label, in no source, no lowercase use in the lesson; none flagged).** `Hunter`,
`Storm`, `Hope`, `Bishop`, `Dash`, `Sparky`. Test: `missed_names_that_read_as_ordinary_words_are_not_flagged_after_a_label`
in `name-scan-residual.test.ts`. By contrast `Medusa`, `Brindle` and `Quillon` are flagged in the same position.

**Why.** After a label the scan decides by the word's class in lower case (`first_word_is_name`): if the tagger reads
the lower-case form as a verb, adjective, noun it knows, or another function word, the word is not treated as a
name. A real character called Hunter or Storm reads as the common word.

**Policy (same as the false-positive residual).** Stay blocking where the scan does flag; the finding is resolvable
by a named reviewer; no whitelist and no word-class exemption; the missed name is a recorded limit of the automatic
check, so a reviewer reading the CFU rationales remains the backstop.

**Lowercase use clears a capitalised form.** Any lowercase occurrence of the word in a source or in the lesson's own
fields (`index.L`) clears every capitalised occurrence, after a label or mid-sentence. Test:
`lowercase_use_elsewhere_in_the_lesson_clears_a_capitalised_form` (`Brindle` flagged alone, cleared by "a brindle
coat"). **Exploitability: low.** An invented name escapes only if the same word also appears as an ordinary lowercase
word in the lesson or its sources; the model does not choose that on purpose, and a reviewer sees the lesson text.
