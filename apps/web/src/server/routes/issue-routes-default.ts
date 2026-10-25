// Default wiring for the issue routes: memoised once per process, resolved lazily against the container.
import { getServices } from "../container.ts";
import { with_route } from "../http/with-route.ts";
import { make_issue_handlers, type IssueHandlers } from "./issue-routes.ts";
import type { IssueApi } from "../services/issue-service.ts";

export const issue_handlers: IssueHandlers = make_issue_handlers({
  with_route,
  // `issues` is unset until NL-53 fills wiring/review.ts; the container proxy throws "NOT BUILT: NL-53" meanwhile.
  issues: () => getServices().issues as unknown as IssueApi,
  logger: {
    info: (e, f) => getServices().logger.info(e, f),
    warn: (e, f) => getServices().logger.warn(e, f),
    error: (e, f) => getServices().logger.error(e, f),
  },
});
