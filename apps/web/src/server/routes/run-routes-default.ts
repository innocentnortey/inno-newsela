// Default wiring for the run routes (NL-78): the real with_route over the container's RunService.
import { getServices } from "../container.ts";
import { with_route } from "../http/with-route.ts";
import { make_run_handlers, type RunApi } from "./run-routes.ts";

export const run_handlers = make_run_handlers({ with_route, runs: () => getServices().runs as unknown as RunApi });
