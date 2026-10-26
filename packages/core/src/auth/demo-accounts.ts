// The ONE definition of the demo accounts: ops/seed.ts creates them (when SEED_ALLOW_DEMO_ACCOUNTS=1 with this password)
// and the SCR-1 demo-accounts box displays them. Synthetic data only; never used by Render.
export const DEMO_PASSWORD = "demo-password-synthetic";
export const DEMO_ACCOUNTS = [
  { role: "author", email: "author.demo@example.test", name: "Demo author" },
  { role: "reviewer", email: "reviewer.demo@example.test", name: "Demo reviewer" },
  { role: "approver", email: "approver.demo@example.test", name: "Demo approver" },
] as const;
