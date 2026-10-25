// NL-12: the real PgDatabase satisfies the core TxRunner port; the web app uses it directly and
// the worker and collab shells (which must not import @ls/db, see their shells tests) depend on TxRunner.
import type { TxRunner } from "@ls/core/ports/tx";
import type { PgDatabase } from "@ls/db/pool";
import { expectTypeOf } from "vitest";
import type { CollabDeps } from "../../apps/collab/src/deps-types.ts";
import type { WorkerDeps } from "../../apps/worker/src/deps-types.ts";
import type { PgDatabase as WebPgDatabase } from "../../apps/web/src/server/deps-types.ts";

expectTypeOf<PgDatabase>().toExtend<TxRunner>();
expectTypeOf<WebPgDatabase>().toEqualTypeOf<PgDatabase>();
expectTypeOf<WorkerDeps["db"]>().toEqualTypeOf<TxRunner>();
expectTypeOf<CollabDeps["db"]>().toEqualTypeOf<TxRunner>();
expectTypeOf<PgDatabase>().toExtend<WorkerDeps["db"]>();
expectTypeOf<PgDatabase>().toExtend<CollabDeps["db"]>();
