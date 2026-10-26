// NL-125 (WF-43): S5 assertion `suggestion_blocks`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { suggestion_blocks } from "./scenarios";

defineAssertion("suggestion_blocks", {}, suggestion_blocks);
