// NL-117 (WF-18, SCR-18, CON-22) on the real stack. test_coverage_matrix_reads_links: the 3-lesson matrix equals a hand count,
// read through the API and off the screen. The expected values come from hand-count.json only (typed by hand before any spec).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, request as pwRequest } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser } from "../support/users";
import { as, COVERAGE_API, coverageUrl, getMatrix, p95, screenCells, type Matrix } from "./helpers";
import { dropWeirdStandard, ensureSeeded, freshUnit, seedFortySeven, seedThreeLessons, weirdStandard, WEIRD_CODE, workingHash, type ThreeLessons } from "./seed";
import { seedLesson } from "../con-20/seed";

test.setTimeout(240_000);

interface Hand {
  standards: { code: string; never_assessed: boolean }[];
  lessons: { number: number }[];
  cells: { code: string; lesson: number; roles: string[]; confirmed_by: string; source: string }[];
}
const HAND = JSON.parse(readFileSync(join(__dirname, "hand-count.json"), "utf8")) as Hand;
const MARK: Record<string, string> = { person: "Person", judge_only: "Judge only", generator_only: "Generator only" };

let three: Promise<ThreeLessons> | undefined;
const fixture = (): Promise<ThreeLessons> => (three ??= seedThreeLessons());

test("test_coverage_matrix_reads_links hand_count: the 3-lesson matrix equals the hand count cell for cell", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  const m = await getMatrix(page, fx.unit.unit_id);

  expect(m.standards.map((s) => ({ code: s.code, never_assessed: s.never_assessed }))).toEqual(HAND.standards);
  expect(m.lessons.map((l) => l.number)).toEqual(HAND.lessons.map((l) => l.number));
  const got = m.cells.map((c) => ({ code: c.code, lesson_id: c.lesson_id, roles: c.roles, confirmed_by: c.confirmed_by, source: c.source }));
  const want = HAND.cells.map((c) => ({ code: c.code, lesson_id: `${fx.unit.unit_id}.L${c.lesson}`, roles: c.roles, confirmed_by: c.confirmed_by, source: c.source }));
  let differing = 0;
  for (const w of want) if (!got.some((g) => JSON.stringify(g) === JSON.stringify(w))) differing += 1;
  differing += Math.abs(got.length - want.length);
  console.log(`API cells: ${got.length}, differing cells: ${differing}`);
  expect(got.length).toBe(8);
  expect(differing).toBe(0);
  expect(got).toEqual(want);

  // The same matrix on the screen: letters and mark word per standard row and lesson column.
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.getByRole("heading", { name: "Coverage", level: 1 })).toBeVisible();
  await expect(page.locator("main table tbody tr[data-code]")).toHaveCount(4);
  const shown = await screenCells(page);
  let screenDiff = 0;
  for (const s of HAND.standards) {
    for (const l of HAND.lessons) {
      const h = HAND.cells.find((c) => c.code === s.code && c.lesson === l.number);
      const d = shown.find((x) => x.code === s.code && x.lesson === l.number)!;
      const wantLetters = h ? h.roles.join(" ") : "";
      const wantMark = h ? MARK[h.confirmed_by]! : "";
      if (d.letters !== wantLetters || d.mark !== wantMark) {
        screenDiff += 1;
        console.log(`screen differs ${s.code} L${l.number}: got ${JSON.stringify([d.letters, d.mark])} want ${JSON.stringify([wantLetters, wantMark])}`);
      }
    }
  }
  console.log(`differing cells: ${screenDiff}`);
  expect(screenDiff).toBe(0);
});

test("source_and_never_assessed: approved snapshot vs working row, W.6.2.a highlighted", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  const m = await getMatrix(page, fx.unit.unit_id);
  for (const c of m.cells) expect(c.source, `${c.code} ${c.lesson_id}`).toBe(c.lesson_id === fx.ids.l4 ? "approved" : "working");
  expect(new Set(m.cells.map((c) => c.source))).toEqual(new Set(["approved", "working"]));
  expect(JSON.stringify(m)).not.toContain("L.6.4.d");
  expect(m.standards.find((s) => s.code === "W.6.2.a")!.never_assessed).toBe(true);
  for (const s of m.standards.filter((x) => x.code !== "W.6.2.a")) expect(s.never_assessed, s.code).toBe(false);
  // The decoy: two links stored under L4's working hash exist, and none of them reaches the response.
  const decoy = await db().count("alignment_link", "lesson_id=$1 and content_hash=$2", [fx.ids.l4, fx.decoy_hash]);
  expect(decoy).toBe(2);
  expect(fx.decoy_hash).not.toBe(fx.approved_hash);
  expect(m.cells.some((c) => c.code === "W.6.2.a" && c.lesson_id === fx.ids.l4)).toBe(false);

  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("main table")).toBeVisible();
  await expect(page.getByText("Never assessed")).toHaveCount(1);
  await expect(page.locator('tr[data-code="W.6.2.a"]').getByText("Never assessed")).toBeVisible();
});

test("read_only: five reads change no row and make no model call", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  const tables = ["model_call", "audit_event", "lesson_version", "alignment_link"];
  const snap = async (): Promise<number[]> => Promise.all(tables.map((t) => db().count(t)));
  const lessonCalls = (): Promise<number> => db().count("model_call", "lesson_id like $1", [`${fx.unit.unit_id}.%`]);
  const before = await snap();
  await getMatrix(page, fx.unit.unit_id);
  await getMatrix(page, fx.unit.unit_id);
  await getMatrix(page, fx.unit.unit_id);
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("main table")).toBeVisible();
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("main table")).toBeVisible();
  const after = await snap();
  console.log(`rows before ${before.join("/")} after ${after.join("/")} (${tables.join("/")})`);
  expect(after).toEqual(before);
  expect(await lessonCalls()).toBe(0);
});

test("text_and_not_found: official text is text, unknown unit is NOT_FOUND", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const l3 = await seedLesson({ unit, number: 3, state: "submitted", content: "wp1" });
  try {
    await weirdStandard(l3.lesson_id);
    await as(page, "reviewer");
    await page.goto(coverageUrl(unit.unit_key));
    await expect(page.locator(`tr[data-code="${WEIRD_CODE}"]`)).toBeVisible();
    await expect(page.locator("main table b")).toHaveCount(0);
    await expect(page.locator(`tr[data-code="${WEIRD_CODE}"]`)).toContainText("<b>x</b> synthetic");
    expect(await page.locator("main").innerText()).toContain("<b>x</b>");
  } finally {
    await dropWeirdStandard();
  }
  expect(await db().count("unit", "id=$1", ["G9.U99"])).toBe(0);
  const res = await page.request.get(COVERAGE_API("G9.U99"));
  expect(res.status()).toBe(404);
  expect(((await res.json()) as { error?: { code?: string } }).error?.code).toBe("NOT_FOUND");
  await page.goto(coverageUrl("g9-u99"));
  await expect(page.getByText("There is no unit in Grade 9 · Unit 99")).toBeVisible();
  await expect(page.locator("main table")).toHaveCount(0);
  // Anonymous: 401 (also asserted under R-54).
  const anon = await pwRequest.newContext({ baseURL: getStack().baseURL });
  expect((await anon.get(COVERAGE_API(unit.unit_id))).status()).toBe(401);
  await anon.dispose();
});

test("timing: p95 under 1 s over 20 consecutive reads on 47 lessons", async ({ page }) => {
  const unit = await seedFortySeven();
  await as(page, "reviewer");
  const warm = await page.request.get(COVERAGE_API(unit.unit_id));
  expect(warm.status()).toBe(200);
  const times: number[] = [];
  let last: Matrix | undefined;
  for (let i = 0; i < 20; i++) {
    const t0 = Date.now();
    const res = await page.request.get(COVERAGE_API(unit.unit_id));
    last = (await res.json()) as Matrix;
    times.push(Date.now() - t0);
    expect(res.status()).toBe(200);
  }
  const p = p95(times);
  console.log("coverage p95 ms:", p, "all:", times.join(","), "cells:", last!.cells.length);
  expect(last!.lessons.length).toBe(47);
  expect(p).toBeLessThan(1000);
});

test("roles: author, reviewer and approver all read the same matrix", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  const base = await (await page.request.get(COVERAGE_API(fx.unit.unit_id))).text();
  for (const role of ["author", "reviewer", "approver"] as const) {
    await page.context().clearCookies();
    await as(page, await createUser(role));
    const res = await page.request.get(COVERAGE_API(fx.unit.unit_id));
    expect(res.status(), role).toBe(200);
    expect(JSON.parse(await res.text()), role).toEqual(JSON.parse(base));
  }
});

test("seams: unit key form, SCR-9 opener, unknown standard code", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  // S-A: INTERFACE.md says the unit key works too; the handler takes the id form. Recorded, not asserted.
  const byKey = await page.request.get(COVERAGE_API(fx.unit.unit_key));
  console.log(`S-A: GET /api/units/${fx.unit.unit_key}/coverage -> ${byKey.status()}`);
  // S-C: a stored link whose code is missing from `standard` (probe row removed afterwards).
  const unit = await freshUnit();
  const l3 = await seedLesson({ unit, number: 3, state: "submitted", content: "wp1" });
  const probe = "ZZ.E2E.MISSING";
  await db().query(
    "insert into alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by) values ($1,$2,$3,$4,'I','outline','reviewer',null)",
    [l3.lesson_id, await workingHash(l3.lesson_id), probe, `${l3.lesson_id}.probe`],
  );
  try {
    const m = await getMatrix(page, unit.unit_id);
    const s = m.standards.find((x) => x.code === probe);
    console.log(`S-C: missing standard row -> ${JSON.stringify(s)}`);
    expect(s).toBeDefined();
    expect(s!.official_text).toBe("");
  } finally {
    await db().query("delete from alignment_link where code=$1", [probe]);
  }
});

test("reach_from_board: the board's Coverage link opens the matrix and Back returns", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  await page.goto(`/units/${fx.unit.unit_key}/board`);
  const nav = page.getByRole("navigation", { name: "Related pages" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Coverage" }).click();
  await expect(page).toHaveURL(new RegExp(`/units/${fx.unit.unit_key}/coverage$`));
  await expect(page.getByRole("heading", { name: "Coverage", level: 1 })).toBeVisible();
  await expect(page.locator("main table")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/units/${fx.unit.unit_key}/board$`));
});

test("reach_lesson_from_column: a lesson column header opens that lesson", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  await page.goto(coverageUrl(fx.unit.unit_key));
  await page.getByRole("link", { name: "Lesson 4" }).click();
  await expect(page).toHaveURL(new RegExp(`/units/${fx.unit.unit_key}/lessons/L4$`));
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(/not found/i)).toHaveCount(0);
});

test("reach_standard_param: ?standard= marks the row (URL-only entry; no screen links here yet)", async ({ page }) => {
  const fx = await fixture();
  await as(page, "reviewer");
  await page.goto(`${coverageUrl(fx.unit.unit_key)}?standard=RL.6.1`);
  await expect(page.locator('tr[data-code="RL.6.1"]')).toHaveAttribute("aria-current", "true");
  await expect(page.locator('tr[data-code="RL.6.2"]')).not.toHaveAttribute("aria-current", "true");
});
