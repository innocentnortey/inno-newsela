// NL-102 AC-14: the container slot is a real ExportService and building it touches nothing.
import { describe, expect, it } from "vitest";
import type { WebDeps } from "../deps.ts";
import { ExportService } from "../services/export-service.ts";
import { wire_exports } from "./exports.ts";

describe("wire_exports", () => {
  it("container_resolves_exports", () => {
    const boom = (): never => {
      throw new Error("db must not be touched at wiring time");
    };
    const trap = new Proxy({}, { get: boom });
    const w = wire_exports({ db: trap, ids: trap, clock: trap, model_client: trap } as unknown as WebDeps);
    expect(w.exports).toBeInstanceOf(ExportService);
  });
});
