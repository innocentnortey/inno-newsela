// Default wiring for the heartbeat route. `heartbeats` is filled by NL-54; until then the container throws.
import { with_route } from "../http/with-route.ts";
import { getServices } from "../container.ts";
import type { HeartbeatService } from "../services/heartbeat-service.ts";
import { make_heartbeat_handlers } from "./heartbeat-routes.ts";

export const heartbeat_handlers = make_heartbeat_handlers({
  with_route,
  heartbeats: () => getServices().heartbeats as unknown as Pick<HeartbeatService, "record">,
});
