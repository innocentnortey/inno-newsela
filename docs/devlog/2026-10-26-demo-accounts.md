# Demo accounts fix (fix/demo-accounts)

**Changed.** New shared constant `packages/core/src/auth/demo-accounts.ts` (accounts `*.demo@example.test`, password `demo-password-synthetic`); the SCR-1 box and `ops/seed.ts` both read it. With `SEED_ALLOW_DEMO_ACCOUNTS=1` the seed uses that password; flag off is unchanged (random, `.demo/`). Compose gets a `seed` service (profile `seed`) that alone sets the flag; `Dockerfile.node` creates a node-owned `/app/.demo`; README Compose section has the command. `render.yaml` unchanged (sets neither flag).
**Why.** G1 acceptance run: the box showed `example.org` and a fixed password the seed never created.
**Checked.** New `ops/demo-accounts.int.test.ts` (flag on verifies shown credentials; off is random; render has no flags), page flag test, box test; seed, compose-exposure, wf-37, seeded-accounts tests green. No image built.
**Remaining.** Run the seed step in the next Docker acceptance run.
