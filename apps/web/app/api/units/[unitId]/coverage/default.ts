// Default wiring for the coverage route (NL-91).
import { getServices } from "@/server/container.ts";
import { with_route } from "@/server/http/with-route.ts";
import { make_coverage_handlers } from "./handlers.ts";

export const coverage_handlers = make_coverage_handlers({ with_route, coverage: () => getServices().coverage });
