import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@ls/core/auth/demo-accounts";

// Same list the seed creates (SEED_ALLOW_DEMO_ACCOUNTS=1), so the shown credentials sign in.
const ROWS = DEMO_ACCOUNTS.map((a) => ({ role: a.role.charAt(0).toUpperCase() + a.role.slice(1), email: a.email }));
const PASSWORD = DEMO_PASSWORD;

export function DemoAccounts() {
  return (
    <section aria-labelledby="demo-accounts-title" className="bg-well rounded-md p-3 text-small text-ink">
      <h2 id="demo-accounts-title" className="font-semibold">
        Demo accounts
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {ROWS.map((r) => (
          <li key={r.role}>
            <span className="font-semibold">{r.role}</span> {r.email}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-ink2">{`Password for all three: ${PASSWORD}`}</p>
    </section>
  );
}
