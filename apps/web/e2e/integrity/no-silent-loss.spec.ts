// NL-125 (WF-43): S5 assertion `no_silent_loss`, repeated INTEGRITY_TRIALS times (default 20) on a fresh clone with three live contexts.
import { defineAssertion } from "./trial";
import { no_silent_loss } from "./scenarios";

defineAssertion("no_silent_loss", {}, no_silent_loss);
