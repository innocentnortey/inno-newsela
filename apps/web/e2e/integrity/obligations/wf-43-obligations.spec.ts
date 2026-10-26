// NL-125 AC-12: obligations that ride on WF-43 (the integrity suite), one case per id. Browser-free: they read what the suite wrote.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { TRIALS_FILE } from "../results";
import { ROOT, WEB, registered, restrictedFolderRule, staffOnly } from "./support";

// What must never be recorded anywhere (OBS-7): provider keys, session cookie values, passwords, bearer tokens.
const SECRET_SHAPES: readonly RegExp[] = [/sk-ant-[A-Za-z0-9_-]{10,}/, /sk-or-[A-Za-z0-9_-]{10,}/, /sk-[A-Za-z0-9]{32,}/, /ls_session=[A-Za-z0-9_-]{16,}/, /"password"\s*:\s*"[^"]+"/, /Bearer\s+[A-Za-z0-9._-]{16,}/];

function outputs(): string[] {
  const files = [TRIALS_FILE, join(WEB, "test-results/integration-stack/web.log")];
  const reports = join(ROOT, "evals/reports");
  if (existsSync(reports)) files.push(...readdirSync(reports).filter((f) => f.startsWith("integrity-")).map((f) => join(reports, f)));
  return files.filter((f) => existsSync(f));
}

test("GR-9: the restricted source folder is ignored, untracked and never referenced by this ticket's files", async () => {
  restrictedFolderRule();
  for (const f of outputs()) expect(readFileSync(f, "utf8"), f).not.toContain(["docs", "source", "restricted"].join("/"));
});

test("GR-13: staff roles only; the trial lines and reports hold ids and counts, no e-mail address", async () => {
  await staffOnly();
  for (const f of outputs().filter((x) => !x.endsWith("web.log"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/@example\.test|@[a-z0-9-]+\.(com|org|net)\b/i);
});

test("OBS-7: no provider key, cookie value or password in the trial lines, the report or the web log", async () => {
  for (const f of outputs()) {
    const text = readFileSync(f, "utf8");
    for (const re of SECRET_SHAPES) expect(text, `${f} matches ${re}`).not.toMatch(re);
  }
});

test("OBS-11: WF-43 is registered with test_integrity_suite_records and its entry point exists", async () => {
  registered("WF-43", "test_integrity_suite_records", join(ROOT, "evals/src/suites/s5.test.ts"));
  expect(existsSync(join(WEB, "e2e/integrity/run.ts"))).toBe(true);
});
