// NL-97 AC-5: no GET route returns rendered_prompt or raw_output (or the planted canary); reading changes nothing.
// The scripted canary rides in the stub's reply text (stored as raw_output): the prompt is rendered from the outline row and has
// no scripted part (devlog). The scan first proves the canary really is in the database, so a clean scan means something.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { asRole, runScenario, summaryApi } from "./helpers";

test.setTimeout(300_000);
const YAML = resolve(__dirname, "../../../../../docs/contracts/interface.openapi.yaml");

function getRoutes(): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of readFileSync(YAML, "utf8").split("\n")) {
    const p = /^ {2}(\/[^:]*):\s*$/.exec(line);
    if (p) cur = p[1]!;
    else if (/^ {4}get:\s*$/.test(line) && cur) out.push(cur);
  }
  return out;
}

test("traces-only-via-summary: no GET route leaks prompts or raw replies, and reads write nothing", async ({ page }) => {
  const { up, runId } = await runScenario(page, "mixed");
  const canary = `CANARY-97-${runId.slice(-6)}`;
  expect((await db().query("select 1 from model_call where run_id=$1 and raw_output like $2", [runId, `%${canary}%`])).length, "canary stored as raw_output").toBeGreaterThan(0);
  const values: Record<string, string> = { runId, lessonId: "G6.U4.L4", outlineVersionId: up.outline_version_id, unitId: "G6.U4" };
  const routes = getRoutes();
  const usable = routes.filter((r) => [...r.matchAll(/\{(\w+)\}/g)].every((m) => m[1]! in values));
  const skipped = routes.filter((r) => !usable.includes(r));
  console.log(`GET routes in the OpenAPI: ${routes.length}; scanned: ${usable.length}; skipped (params not resolvable from the run): ${skipped.join(", ")}`);
  expect(usable).toContain("/runs/{runId}/summary");
  expect(usable.length).toBeGreaterThan(8);

  let scanned = 0;
  let hits = 0;
  for (const role of ["author", "reviewer", "approver"] as const) {
    await asRole(page, role);
    for (const route of usable) {
      const path = "/api" + route.replace(/\{(\w+)\}/g, (_m, k: string) => encodeURIComponent(values[k]!));
      const res = await page.request.get(path);
      const body = await res.text();
      scanned++;
      for (const needle of ['"rendered_prompt"', '"raw_output"', canary]) if (body.includes(needle)) { hits++; console.log(`LEAK ${role} ${path} ${needle}`); }
    }
  }
  console.log(`bodies scanned: ${scanned}; occurrences of rendered_prompt / raw_output / canary: ${hits}`);
  expect(hits).toBe(0);

  await asRole(page, "author");
  const counts = async () => ({ audit: await db().count("audit_event"), calls: await db().count("model_call") });
  const before = await counts();
  for (let i = 0; i < 5; i++) expect((await page.request.get(summaryApi(runId))).status()).toBe(200);
  expect(await counts()).toEqual(before);
});
