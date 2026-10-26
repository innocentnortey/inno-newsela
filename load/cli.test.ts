// NL-118: argument parsing and the refusals that must happen before any request.
import { describe, expect, it } from "vitest";
import { parse_args, ProbeRefusal } from "./cli.ts";

describe("load cli", () => {
  it("defaults equal the capacity run", () => {
    const c = parse_args([], { DATABASE_URL: "postgres://x" });
    expect([c.users, c.ramp_s, c.plateau_s]).toEqual([200, 120, 900]);
    expect(c.provider_mode).toBe("stub");
    expect(c.database_url).toBe("postgres://x");
    expect(c.password_env).toBe("LOAD_PROBE_PASSWORD");
  });
  it("refuses a real provider, a password flag and a remote host", () => {
    expect(() => parse_args(["--provider", "real"], {})).toThrow(ProbeRefusal);
    expect(() => parse_args(["--password", "x"], {})).toThrow(ProbeRefusal);
    expect(() => parse_args(["--password=x"], {})).toThrow(ProbeRefusal);
    expect(() => parse_args(["--base-url", "https://inno-newsela.onrender.com"], {})).toThrow(ProbeRefusal);
    expect(parse_args(["--base-url", "https://inno-newsela.onrender.com", "--allow-remote"], {}).allow_remote).toBe(true);
    expect(parse_args(["--base-url", "http://localhost:3121"], {}).base_url).toBe("http://localhost:3121");
  });
  it("rejects bad numbers and unknown flags", () => {
    expect(() => parse_args(["--users", "0"], {})).toThrow(ProbeRefusal);
    expect(() => parse_args(["--users", "abc"], {})).toThrow(ProbeRefusal);
    expect(() => parse_args(["--wat"], {})).toThrow(ProbeRefusal);
  });
});
