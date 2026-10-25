// NL-08 AC-12: obligations WF-36 inherits, driven through the real entry point (ops/migrate.ts).
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";

const REPO = new URL("../../../", import.meta.url).pathname;
let t: TestDb;
let stdout = "";
beforeAll(async () => {
  t = await create_test_db({ migrate: false });
  stdout = execFileSync("npx", ["tsx", "ops/migrate.ts"], {
    cwd: REPO,
    env: { ...process.env, DATABASE_URL: t.url },
    encoding: "utf8",
  });
}, 60_000);
afterAll(async () => {
  await t.drop();
});
const q = (sql: string) =>
  t.db.with_tx(async (tx) => (await tx.query(sql)).rows);

describe("WF-36 obligations (AC-12)", () => {
  it("GR-9: restricted source stays git-ignored, untracked and unreferenced by db code", () => {
    expect(
      spawnSync("git", ["check-ignore", "docs/source/restricted/x"], {
        cwd: REPO,
      }).status,
    ).toBe(0);
    expect(
      execFileSync("git", ["ls-files", "docs/source/restricted"], {
        cwd: REPO,
        encoding: "utf8",
      }).trim(),
    ).toBe("");
    for (const dir of ["packages/db/migrations", "packages/db/src"]) {
      for (const f of readdirSync(`${REPO}${dir}`, { withFileTypes: true })) {
        if (!f.isFile() || f.name === "wf-36-obligations.int.test.ts") continue;
        expect(readFileSync(`${REPO}${dir}/${f.name}`, "utf8")).not.toContain(
          "source/restricted",
        );
      }
    }
  });

  it("GR-13: no student or teacher-of-record column; staff role exists", async () => {
    const bad = await q(
      "select table_name, column_name from information_schema.columns where table_schema='public' and column_name ~* '(student|teacher_of_record|\\ydob\\y|birth)'",
    );
    expect(bad).toEqual([]);
    expect(
      await q(
        "select 1 from information_schema.columns where table_name='app_user' and column_name='role'",
      ),
    ).toHaveLength(1);
  });

  it("OBS-7: no event or output carries the database URL or password", async () => {
    const u = new URL(t.url);
    const events = (await q("select details_json::text as d from ops_event"))
      .map((r) => String(r["d"]))
      .join("\n");
    expect(events).not.toContain(u.password);
    expect(events).not.toContain(t.url);
    expect(stdout).not.toContain("postgres://");
    expect(stdout).not.toContain(u.password);
  });

  it("OBS-11: WF-36 is registered in the observability table and script map", () => {
    const obs = readFileSync(`${REPO}docs/design/observability.md`, "utf8");
    expect(obs).toMatch(/^\| WF-36 \|/m);
    const targets = readFileSync(`${REPO}scripts/script-targets.json`, "utf8");
    expect(targets).toContain("ops/migrate.ts");
    expect(targets).toContain("NL-08");
  });
});
