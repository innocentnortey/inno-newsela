// NL-125 (WF-43): S5 assertion `zero_edits_after_lock`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { zero_edits_after_lock } from "./scenarios";

defineAssertion("zero_edits_after_lock", { heldA: true }, zero_edits_after_lock);
