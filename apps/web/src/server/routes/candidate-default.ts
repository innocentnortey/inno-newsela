import { with_route } from "../http/with-route.ts";
import { getServices } from "../container.ts";
import { make_candidate_handlers } from "./candidate-routes.ts";
import type { CandidateApi } from "../services/candidate-service.ts";

// `candidates` is unset until NL-53 fills wiring/review.ts (CandidateService(states, versions, runs, queue, spend,
// collab, audit, tx, settings, lookup, prices, cost); NL-53 must pass `lookup`, `prices` and `cost`); the container
// throws "NOT BUILT: NL-53" until then.
export const candidate_handlers = make_candidate_handlers({
  with_route,
  candidates: () => getServices().candidates as unknown as CandidateApi,
});
