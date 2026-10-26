// NL-125 (WF-43): S5 assertion `stale_approve`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { stale_approve } from "./scenarios";

defineAssertion("stale_approve", {}, stale_approve);
