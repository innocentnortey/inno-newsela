import { expectTypeOf } from "vitest";
import type { WebDeps } from "./deps.ts";
import type { Clock, IdGenerator, IdPrefix, ModelClient, PgDatabase } from "./deps-types.ts";

expectTypeOf<keyof WebDeps>().toEqualTypeOf<"settings" | "logger" | "db" | "ids" | "clock" | "model_client">();
expectTypeOf<WebDeps["db"]>().toEqualTypeOf<PgDatabase>();
expectTypeOf<keyof PgDatabase>().toEqualTypeOf<"with_tx" | "ping" | "close">();
expectTypeOf<keyof IdGenerator>().toEqualTypeOf<"new_id">();
expectTypeOf<keyof Clock>().toEqualTypeOf<"now" | "sleep">();
expectTypeOf<keyof ModelClient>().toEqualTypeOf<"complete">();
expectTypeOf<Parameters<IdGenerator["new_id"]>[0]>().toEqualTypeOf<IdPrefix>();
