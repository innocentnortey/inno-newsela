import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { load_collab_settings } from "@ls/config/settings";
import { build_collab_runtime } from "../main.ts";
import * as lockSnap from "../commands/lock-and-snapshot.ts";

const ENV = {
  DATABASE_URL: "postgres://u:p@localhost:5432/d",
  COLLAB_INTERNAL_TOKEN: "t-collab",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}
const FORBIDDEN = /from\s+"(@ls\/llm|@ls\/db|pg|@anthropic-ai\/sdk|openai)["/]/;
// NL-23 (orchestrator decision, PD-32): the process-start event writers open their own one-connection PgDatabase to
// write the process.start ops_event, and (NL-83) the health files open their own one-connection pool for GET /healthz, so
// these four files, by exact path, may import @ls/db. Nothing else may.
const DB_EXEMPT = new Set(["collab/src/start-event.ts", "worker/src/start-event.ts", "collab/src/health.ts", "worker/src/health.ts"]);
// Type-only imports are erased at compile time, so they pull no runtime module into the entry; the guard is about runtime imports.
function runtime_text(t: string): string {
  return t.replace(/^import type\b[^;]*;/gm, "");
}
function forbidden_for(root: string, f: string): RegExp {
  const rel = f.slice(root.length + 1);
  // Composition roots under wiring/ build the Pg repositories and the PaidCaller, so they may import @ls/db and @ls/llm; a driver or provider SDK stays forbidden everywhere.
  if (/(^|\/)wiring\/[^/]+\.ts$/.test(rel)) return /from\s+"(pg|@anthropic-ai\/sdk|openai)["/]/;
  // NL-89: the worker's judge client factory is the one place outside wiring/ that builds the OpenRouter adapter from @ls/llm.
  // RT-1: the worker composition root builds the Pg database and the model client.
  if (rel === "worker/src/deps.ts") return /from\s+"(pg|@anthropic-ai\/sdk|openai)["/]/;
  // NL-110: the default judge is the offline stub; it may import only the @ls/llm/stub test double, never the provider adapter.
  if (rel === "worker/src/judge/stub-default-judge.ts") return /from\s+"(@ls\/llm(?!\/stub["])|@ls\/db|pg|@anthropic-ai\/sdk|openai)["/]/;
  if (rel === "worker/src/judge/judge-client-factory.ts") return /from\s+"(@ls\/db|pg|@anthropic-ai\/sdk|openai)["/]/;
  return DB_EXEMPT.has(rel) ? /from\s+"(@ls\/llm|pg|@anthropic-ai\/sdk|openai)["/]/ : FORBIDDEN;
}

describe("collab shells", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lock_and_snapshot is built", () => {
    expect(typeof lockSnap.lock_and_snapshot).toBe("function");
  });

  it("collab starts with ANTHROPIC_API_KEY unset and no model settings", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    delete process.env.ANTHROPIC_API_KEY;
    const settings = load_collab_settings(ENV);
    expect("model" in settings).toBe(false);
    const handlers = new Map<string, () => void>();
    const exit = vi.fn();
    const rt = await build_collab_runtime(settings, {
      port: 0,
      log_write: () => {},
      exit,
      signal_host: { on: (s, f) => void handlers.set(s, f) },
    });
    expect(rt.port).toBeGreaterThan(0);
    await rt.stop();
  });

  it("neither entry imports forbidden modules", () => {
    const here = join(import.meta.dirname, "..", "..", "..");
    for (const f of sources(join(here, "collab", "src"))) {
      const t = runtime_text(readFileSync(f, "utf8"));
      expect(t, f).not.toMatch(forbidden_for(here, f));
      expect(t, f).not.toMatch(/apps\/worker|ANTHROPIC_API_KEY/);
    }
    for (const f of sources(join(here, "worker", "src"))) {
      const t = runtime_text(readFileSync(f, "utf8"));
      expect(t, f).not.toMatch(forbidden_for(here, f));
      expect(t, f).not.toMatch(/apps\/collab/);
    }
  });
});
