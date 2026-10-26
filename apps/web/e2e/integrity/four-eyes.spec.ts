// NL-125 (WF-43): S5 assertion `four_eyes`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { four_eyes } from "./scenarios";

defineAssertion("four_eyes", {}, four_eyes);
