import { describe, expect, it } from "vitest";
import {
  ReplaySetupError, connect_read_only, read_only_database_url, read_only_fn, redact, same_counts, verify_read_only,
} from "./replay-finals-readonly.ts";

const opts = (u: string): string => new URL(u).searchParams.get("options") ?? "";

// A fake with_tx whose tx answers the three SHOW/select queries and the probe according to `cfg`.
function fake_db(cfg: { default_ro?: string; tx_ro?: string; probe_code?: string | null }) {
  const statements: string[] = [];
  return {
    statements,
    closed: 0,
    async close() { this.closed += 1; },
    async with_tx<T>(fn: (tx: never) => Promise<T>): Promise<T> {
      const tx = {
        async query(text: string) {
          statements.push(text);
          if (text.includes("('default_transaction_read_only')")) return { rows: [{ v: cfg.default_ro ?? "on" }], rowCount: 1 };
          if (text.includes("('transaction_read_only')")) return { rows: [{ v: cfg.tx_ro ?? "on" }], rowCount: 1 };
          if (text.startsWith("select current_database")) return { rows: [{ db: "ls_x", port: 55440, v: "16.1" }], rowCount: 1 };
          if (text.startsWith("create temp")) {
            if (cfg.probe_code === null) return { rows: [], rowCount: 0 };
            throw Object.assign(new Error("read-only transaction"), { code: cfg.probe_code ?? "25006" });
          }
          return { rows: [], rowCount: 0 };
        },
      };
      return fn(tx as never);
    },
  };
}

describe("read_only_database_url", () => {
  it("test_url_without_query_gets_options", () => {
    const u = read_only_database_url("postgres://u:p@h:5432/d");
    expect(opts(u)).toBe("-c default_transaction_read_only=on");
    expect(u).toContain("options=-c%20default_transaction_read_only%3Don");
  });
  it("test_url_with_existing_query_keeps_params_and_appends_options", () => {
    const a = read_only_database_url("postgres://u:p@h/d?sslmode=disable");
    expect(new URL(a).searchParams.get("sslmode")).toBe("disable");
    expect(opts(a)).toBe("-c default_transaction_read_only=on");
    const b = read_only_database_url("postgres://u:p@h/d?sslmode=disable&options=-c%20statement_timeout%3D5");
    expect(new URL(b).searchParams.get("sslmode")).toBe("disable");
    expect(opts(b)).toBe("-c statement_timeout=5 -c default_transaction_read_only=on");
  });
  it("test_url_asking_for_read_only_off_is_overridden", () => {
    const a = read_only_database_url("postgres://u:p@h/d?options=-c%20default_transaction_read_only%3Doff");
    expect(opts(a).endsWith("-c default_transaction_read_only=on")).toBe(true);
    const b = read_only_database_url("postgres://u:p@h/d?default_transaction_read_only=off");
    expect(new URL(b).searchParams.has("default_transaction_read_only")).toBe(false);
    expect(opts(b)).toBe("-c default_transaction_read_only=on");
  });
  it("test_invalid_and_non_postgres_urls_throw_without_echoing", () => {
    for (const bad of ["not a url s3cret", "http://u:s3cret@h/d"]) {
      let msg = "";
      try { read_only_database_url(bad); } catch (e) { expect(e).toBeInstanceOf(ReplaySetupError); msg = (e as Error).message; }
      expect(msg).not.toBe("");
      expect(msg).not.toContain("s3cret");
      expect(msg).not.toContain(bad);
    }
  });
});

describe("transactions", () => {
  it("test_with_tx_sets_transaction_read_only_first", async () => {
    const seen: string[] = [];
    const tx = { async query(t: string) { seen.push(t); return { rows: [], rowCount: 0 }; } };
    await read_only_fn(async (t) => { await t.query("select 1"); })(tx as never);
    expect(seen).toEqual(["SET TRANSACTION READ ONLY", "select 1"]);
  });
});

describe("verify_read_only", () => {
  it("test_verify_rejects_when_default_is_off", async () => {
    await expect(verify_read_only(fake_db({ default_ro: "off" }))).rejects.toMatchObject({ code: "read_only_not_enforced" });
  });
  it("test_verify_rejects_when_the_write_probe_succeeds", async () => {
    await expect(verify_read_only(fake_db({ probe_code: null }))).rejects.toMatchObject({ code: "read_only_not_enforced" });
    await expect(verify_read_only(fake_db({ probe_code: "42P01" }))).rejects.toMatchObject({ code: "read_only_not_enforced" });
  });
  it("test_verify_accepts_25006", async () => {
    expect(await verify_read_only(fake_db({}))).toMatchObject({ database: "ls_x", port: 55440, write_probe: "rejected_25006", transaction_read_only: "on" });
  });
});

describe("credentials and setup failure", () => {
  const raw = "postgres://alice:s3cret@h:5432/d";
  it("test_redact_removes_password_user_and_url", () => {
    const out = redact(`failed ${raw} for alice with s3cret and ${read_only_database_url(raw)}`, raw);
    for (const w of ["s3cret", "alice", raw]) expect(out).not.toContain(w);
    expect(out).toContain("<redacted>");
  });
  it("test_setup_failure_stops_and_never_tries_another_url", async () => {
    const urls: string[] = [];
    const factory = (u: string) => { urls.push(u); throw new Error("connect refused"); };
    await expect(connect_read_only({ DATABASE_URL: raw, TEST_DATABASE_URL: "postgres://other:pw2@t/evidence" }, factory)).rejects.toMatchObject({ code: "connect_failed" });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("alice:s3cret@h:5432/d");
    expect(urls.join()).not.toContain("evidence");
  });
  it("test_missing_database_url_throws", async () => {
    await expect(connect_read_only({ TEST_DATABASE_URL: "postgres://a:b@c/d" })).rejects.toMatchObject({ code: "database_url_missing" });
    await expect(connect_read_only({ DATABASE_URL: "  " })).rejects.toMatchObject({ code: "database_url_missing" });
  });
  it("test_connect_error_text_has_no_credentials", async () => {
    const factory = () => { throw new Error("could not connect to postgres://u:s3cret@h/d"); };
    let msg = "";
    try { await connect_read_only({ DATABASE_URL: "postgres://u:s3cret@h/d" }, factory); } catch (e) { msg = (e as Error).message; }
    expect(msg).not.toBe("");
    expect(msg).not.toContain("s3cret");
    expect(msg).not.toContain("postgres://u:");
  });
  it("test_row_counts_compare", () => {
    expect(same_counts({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual({ same: true, differing: [] });
    expect(same_counts({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ same: false, differing: ["b"] });
  });
});
