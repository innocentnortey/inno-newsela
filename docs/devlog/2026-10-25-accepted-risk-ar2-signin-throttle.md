# AR-2 accepted risk: sign-in has no per-IP/per-email throttle (NL-25)

**Changed.** Nothing; recorded from the wave-3 security review (2026-10-25).
**Why accepted.** CON-1 mandates distinct `NOT_ON_ALLOW_LIST` / `INVALID_CREDENTIALS` codes (allow-listed staff accounts only; accounts are seeded demo/staff accounts, ~a handful), every failed attempt sleeps 1 s and logs only a salted email hash, scrypt costs bound brute force, and the approved deployment is local Docker Compose for the recording (PD-15 D).
**Before any real deployment.** Add per-IP and per-email throttling (token bucket in Postgres or the edge), pass a real `ip_hash` (currently `null` in `app/api/session/route.ts`), and revisit whether the two error codes should collapse.
**Checked.** Review text: security review part 1, NL-25 item 4. **Remaining.** A throttle ticket if the project is ever deployed beyond the demo.
