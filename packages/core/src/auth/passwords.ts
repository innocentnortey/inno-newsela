// Scrypt password helpers (NL-25 AC-8). Pure: node:crypto only. Stored form: scrypt$N$r$p$salt_b64$hash_b64.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
// Caps so a tampered stored hash cannot make us burn CPU or memory.
const MAX_N = 2 ** 20;
const MAX_R = 16;
const MAX_P = 4;
const B64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

export function hash_password(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(password, salt, KEY_BYTES, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

function positive_int(s: string, max: number): number | null {
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 && n <= max ? n : null;
}

// Never throws: attacker-controlled stored data returns false.
export function verify_password(stored_hash: string, password: string): boolean {
  try {
    if (password === "") return false;
    const parts = stored_hash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const n = positive_int(parts[1]!, MAX_N);
    const r = positive_int(parts[2]!, MAX_R);
    const p = positive_int(parts[3]!, MAX_P);
    if (n === null || r === null || p === null) return false;
    if (!B64.test(parts[4]!) || !B64.test(parts[5]!)) return false;
    const salt = Buffer.from(parts[4]!, "base64");
    const expected = Buffer.from(parts[5]!, "base64");
    if (salt.length === 0 || expected.length !== KEY_BYTES) return false;
    const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
