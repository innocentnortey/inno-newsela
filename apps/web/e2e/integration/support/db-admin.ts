// NL-90 support: run with `npx tsx` (the repo packages are ESM; Playwright loads e2e as CJS). create: make + migrate a fresh ls_t_* DB, print {url,name}. drop <name>: drop it.
import pg from "pg";
import { create_test_db, TEST_DATABASE_URL } from "@ls/db/testing/test-db";

async function main(): Promise<void> {
  const [cmd, name] = process.argv.slice(2);
  if (cmd === "create") {
    const t = await create_test_db();
    await t.db.close();
    process.stdout.write(JSON.stringify({ url: t.url, name: t.name }));
  } else if (cmd === "drop" && name && /^ls_t_[0-9a-f]+$/.test(name)) {
    const a = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await a.connect();
    try {
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    } finally {
      await a.end();
    }
  } else {
    process.stderr.write("usage: db-admin.ts create | drop ls_t_<hex>\n");
    process.exit(2);
  }
}
main().catch((e) => {
  process.stderr.write(String(e));
  process.exit(1);
});
