// @vitest-environment node
// NL-116: assist wiring. Synthetic settings; no database is touched.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { load_web_settings } from "@ls/config/settings";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { StubModelClient } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { SERVICES_KEY, build_web_services } from "../container.ts";
import type { WebDeps } from "../deps.ts";
import { SuggestionService } from "../services/suggestion-service.ts";
import { DEFAULT_ASSIST_TEXT, read_assist_script, script_stub_assist, wire_assist } from "./assist.ts";

const BASE = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const reset = () => {
  delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
};
let dir: string;
beforeEach(() => {
  reset();
  dir = mkdtempSync(join(tmpdir(), "nl116-"));
});
afterEach(() => {
  reset();
  rmSync(dir, { recursive: true, force: true });
});

const deps = (extra: Record<string, string> = {}, client: unknown = new StubModelClient()): WebDeps => {
  const throwing_db = new Proxy({}, { get: () => { throw new Error("db touched while wiring"); } });
  return {
    settings: load_web_settings({ ...BASE, ...extra }),
    db: throwing_db,
    ids: new PrefixedIdGenerator(),
    clock: { now: () => new Date(), sleep: async () => {} },
    logger: create_logger({ service: "web", build_id: "test", write: () => {} }),
    model_client: client,
  } as unknown as WebDeps;
};
const req = { alias: "ASSIST", output_schema_name: "AssistRewrite", system_blocks: [], user_blocks: [] } as never;
const complete = (c: StubModelClient) => c.complete(req);

describe("wire_assist (NL-116)", () => {
  it("wire_assist builds SuggestionService with 11 args and does not touch the database", () => {
    const w = wire_assist(deps());
    expect(w.suggestions).toBeInstanceOf(SuggestionService);
    expect(SuggestionService.length).toBe(11);
  });

  it("the container resolves suggestions", () => {
    const s = build_web_services(load_web_settings(BASE));
    expect(s.suggestions).toBeInstanceOf(SuggestionService);
  });

  it("stub mode scripts the assist alias from the control file", async () => {
    const file = join(dir, "ctl.json");
    const client = new StubModelClient({ clock: { now: () => new Date(), sleep: async () => {} } });
    expect(script_stub_assist(deps({}, client), { ASSIST_STUB_FILE: file })).toBe(true);
    // missing file -> default text
    expect(JSON.parse((await complete(client)).raw_text)).toEqual({ suggested_text: DEFAULT_ASSIST_TEXT });
    // text, re-read on every call
    writeFileSync(file, JSON.stringify({ kind: "text", text: "Hello <b>x</b>" }));
    expect(JSON.parse((await complete(client)).raw_text)).toEqual({ suggested_text: "Hello <b>x</b>" });
    // delay then text
    writeFileSync(file, JSON.stringify({ kind: "delay", ms: 1, then: { kind: "text", text: "late" } }));
    expect(JSON.parse((await complete(client)).raw_text)).toEqual({ suggested_text: "late" });
    // error
    writeFileSync(file, JSON.stringify({ kind: "error", code: "boom" }));
    await expect(complete(client)).rejects.toMatchObject({ message: "boom", kind: "timeout" });
    writeFileSync(file, JSON.stringify({ kind: "error", code: "x", error_kind: "server_error" }));
    await expect(complete(client)).rejects.toMatchObject({ kind: "server_error" });
    // garbage -> default
    writeFileSync(file, "{not json");
    expect(JSON.parse((await complete(client)).raw_text)).toEqual({ suggested_text: DEFAULT_ASSIST_TEXT });
    expect(read_assist_script(undefined)).toMatchObject({ kind: "text" });
  });

  it("real mode scripts nothing and reads no control file", async () => {
    const file = join(dir, "ctl.json");
    writeFileSync(file, JSON.stringify({ kind: "text", text: "x" }));
    const client = new StubModelClient();
    const real = deps({ MODEL_PROVIDER_MODE: "real", ANTHROPIC_API_KEY: "sk-synthetic" }, client);
    expect(real.settings.model.model_provider_mode).toBe("real");
    expect(script_stub_assist(real, { ASSIST_STUB_FILE: file })).toBe(false);
    await expect(complete(client)).rejects.toThrow(/unscripted/);
    // a non-stub client in stub mode is also left alone
    expect(script_stub_assist(deps({}, {}), { ASSIST_STUB_FILE: file })).toBe(false);
  });
});
