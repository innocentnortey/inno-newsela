import { getServices } from "@/server/container";
import { with_route } from "@/server/http/with-route";
import { make_post, make_start_run_handler, type RunStarter } from "@/server/services/run-start-route";

// RunWiring.runs is typed `undefined` until NL-78 fills wiring/runs.ts; the cast is removed there.
export const POST = make_post(make_start_run_handler(with_route, () => getServices().runs as unknown as RunStarter));
