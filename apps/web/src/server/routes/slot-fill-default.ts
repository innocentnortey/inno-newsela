import { with_route } from "../http/with-route.ts";
import { getServices } from "../container.ts";
import { make_slot_fill_handlers } from "./slot-fill-routes.ts";
import type { SlotApi } from "../services/slot-service.ts";

// `slots` is unset until NL-53 fills wiring/review.ts; the container throws "NOT BUILT: NL-53" until then.
export const slot_fill_handlers = make_slot_fill_handlers({
  with_route,
  slots: () => getServices().slots as unknown as SlotApi,
});
