// Same values as src/test-utils/fixtures.ts (not importable from app code). Synthetic demo data only.
const ROWS = [
  { role: "Author", email: "author.demo@example.org" },
  { role: "Reviewer", email: "reviewer.demo@example.org" },
  { role: "Approver", email: "approver.demo@example.org" },
];
const PASSWORD = "demo-password-synthetic";

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
