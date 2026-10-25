// Default wiring for the lesson read routes. `lesson_reads` is filled by NL-53; until then the container throws.
import { with_route } from "../http/with-route.ts";
import { getServices } from "../container.ts";
import type { LessonReadApi } from "../services/lesson-read-service.ts";
import { make_lesson_read_handlers } from "./lesson-read-routes.ts";

export const lesson_read_handlers = make_lesson_read_handlers({
  with_route,
  reads: () => getServices().lesson_reads as unknown as LessonReadApi,
  logger: {
    info: (e, f) => getServices().logger.info(e, f),
    warn: (e, f) => getServices().logger.warn(e, f),
    error: (e, f) => getServices().logger.error(e, f),
  },
});
