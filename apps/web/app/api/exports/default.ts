// NL-51: default instance bound to the container. `exports` is filled by NL-102; until then it throws.
import { getServices } from "@/server/container.ts";
import { with_route } from "@/server/http/with-route.ts";
import { make_export_handlers, type ExportApi } from "./http.ts";

export const export_handlers = make_export_handlers({
  with_route,
  exports: () => {
    const s = getServices().exports;
    if (s === undefined) throw new Error("exports are not wired (NL-102)");
    return s as unknown as ExportApi;
  },
});
