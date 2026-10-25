// NL-25 AC-8 (invariant): scrypt password helpers. Frozen; see docs/plans/frozen-tests/NL-25.manifest.json.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hash_password, verify_password } from "./passwords.ts";

const PW = "demo-password-synthetic-author";

describe("passwords (AC-8)", () => {
  const stored = hash_password(PW);

  it("invariant: hash is self-describing scrypt$N$r$p$salt$hash and distinct per call (random salt)", () => {
    expect(stored).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=_-]+\$[A-Za-z0-9+/=_-]+$/);
    expect(stored.split("$")).toHaveLength(6);
    expect(stored).not.toContain(PW);
    expect(hash_password(PW)).not.toBe(stored);
  });
  it("invariant: verify is true only for the right password", () => {
    expect(verify_password(stored, PW)).toBe(true);
  });
  it("invariant: wrong password is false", () => {
    expect(verify_password(stored, PW + "x")).toBe(false);
  });
  it("boundary: empty password is false and does not throw", () => {
    expect(verify_password(stored, "")).toBe(false);
  });
  it("boundary: truncated stored hash is false and does not throw", () => {
    expect(verify_password(stored.slice(0, stored.length - 12), PW)).toBe(false);
    expect(verify_password(stored.split("$").slice(0, 4).join("$"), PW)).toBe(false);
    expect(verify_password("", PW)).toBe(false);
  });
  it("negative: tampered stored hash is false and does not throw", () => {
    const parts = stored.split("$");
    const last = parts[5]!;
    parts[5] = (last[0] === "A" ? "B" : "A") + last.slice(1);
    expect(verify_password(parts.join("$"), PW)).toBe(false);
  });
  it("negative: non-scrypt stored hash is false and does not throw", () => {
    expect(verify_password("bcrypt$10$abcdefghijklmnopqrstuv$abcdefghijklmnopqrstuvwxyz0123456789", PW)).toBe(false);
    expect(verify_password("plaintext-password", PW)).toBe(false);
  });
  it("negative: absurd cost parameters are refused fast, never throw or hang", () => {
    const parts = stored.split("$");
    parts[1] = String(2 ** 30);
    const t0 = Date.now();
    expect(verify_password(parts.join("$"), PW)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it("invariant: comparison uses timingSafeEqual", () => {
    const src = readFileSync(new URL("./passwords.ts", import.meta.url), "utf8");
    expect(src).toMatch(/timingSafeEqual/);
  });
});
