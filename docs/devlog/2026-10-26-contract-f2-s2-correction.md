# Contract F2: S2 `clean_reading` setup correction (2026-10-26)

**Authority.** Handoff section 2, last bullet ("correct its setup under the recorded contract procedure rather than
retaining a production validation hole") and F2-D7 (tagged codes are always resolved against the official standards;
missing lookup context never means valid). Approved as an extra file by the orchestrator (PD-32 request).

**Scope.** One recipe line in `evals/src/suites/s2-fixtures.ts` (`clean_reading`), plus the import of the new helper
`clean_reading_ctx` from `packages/core/src/checks/rules/alignment/test-support.ts`. No change to `evals/cases/s2/*.json`,
no expectation, assertion, threshold or floor. The frozen expected outcomes are unchanged: `s2-clean-lesson` still
expects zero blocking findings. The other S2 recipes were not red and are untouched.

**Why.** The old recipe built a lesson with a tagged Pulse Check (`RL.6.1`), no listed code, nothing recorded and an
empty catalogue; `code_not_allowed` accepted it only through the `standards.length === 0` bypass that F2 removed. The
corrected clean lesson lists RL.6.1, records it, teaches it (the Learning in Action routine is tagged), checks it
(the Pulse Check) and carries the catalogue.

**Checked.** `npx vitest run evals/src/suites/s2.test.ts` 6 of 6 (28 of 28 rule cases as D reported; the file's own
count of cases is unchanged); `evals/src/suites/s1.test.ts` run in the F2 report.
