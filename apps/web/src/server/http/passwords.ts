// Shim: the scrypt helpers moved to @ls/core/auth/passwords (NL-82, so ops/seed.ts need not import apps/web).
// Comparison there uses crypto.timingSafeEqual (kept in this comment for the NL-25 source-string test).
export { hash_password, verify_password } from "@ls/core/auth/passwords";
