// NL-125 (WF-43): S5 assertion `round_trip`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { round_trip } from "./scenarios";

defineAssertion("round_trip", {}, round_trip);
