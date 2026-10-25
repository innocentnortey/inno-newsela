import { with_route } from "../http/with-route.ts";
import { getServices } from "../container.ts";
import { make_transition_handlers } from "./transition-routes.ts";
import type { TransitionApi } from "../services/transition-service.ts";

export const transition_handlers = make_transition_handlers({
  with_route,
  transitions: () => getServices().transitions as unknown as TransitionApi,
});
