// NL-125 (WF-43): S5 assertion `ids`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { ids } from "./scenarios";

defineAssertion("ids", {}, ids, 1); // one trial: the ids are the same on every trial
