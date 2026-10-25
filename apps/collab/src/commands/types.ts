// Shared constructor dependencies of CollabCommandHandler (DO-4 CollabCommandHandler_ctor, minus the Submit-only members NL-106 adds).
import type { SecretStr } from "@ls/config/secret";
import type { CheckContextLoader } from "@ls/core/checks/context-loader";
import type { CheckPolicy, CheckRuleList } from "@ls/core/checks/types";
import type { Clock } from "@ls/core/ports/clock";
import type { IssueRepo } from "@ls/core/ports/issues";
import type { LessonDocReader, LessonDocStore } from "@ls/core/ports/lesson-docs";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo } from "@ls/core/ports/lesson-versions";
import type { StandardRepo } from "@ls/core/ports/standards";
import type { TxRunner } from "@ls/core/ports/tx";
import type { Logger } from "@ls/obs/logger";
import type { AckBroadcaster } from "../acks.ts";
import type { FrozenDocs } from "../frozen-docs.ts";
import type { LessonPersistence } from "../persistence.ts";
import type { HocuspocusServerRef } from "../wiring/server.ts";

export type SubmitLoader = Pick<CheckContextLoader, "load">;

export interface CollabCommandHandlerDeps {
  store: LessonDocStore;
  reader: LessonDocReader;
  states: LessonStateRepo;
  versions: LessonVersionRepo;
  standards: StandardRepo;
  frozen: FrozenDocs;
  acks: AckBroadcaster;
  persistence: LessonPersistence;
  hocuspocus: HocuspocusServerRef;
  tx: TxRunner;
  clock: Clock;
  logger: Logger;
  token: SecretStr;
  loader: SubmitLoader;
  rules: CheckRuleList;
  policy: CheckPolicy;
  issues: IssueRepo;
}
