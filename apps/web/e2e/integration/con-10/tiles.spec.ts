// NL-104 AC-1 (+ reachability a): every route tile equals the oracle's independent SQL and is printed on SCR-19.
import { expect, test } from "@playwright/test";
import { TILE_LABELS } from "../../../src/server/read-models/unit-quality";
import { signInAs } from "../support/users";
import { COPY, getJson, METRICS_PATH, openQuality, tileText } from "./helpers";
import { expectedQuality } from "./oracle";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

for (const name of ["main", "many", "sparse"] as const) {
  test(`tiles-equal-oracle: ${name} unit, 16 tiles route = oracle = screen`, async ({ page }) => {
    const u = UNITS[name];
    const rev = ids.reviewers[0]!;
    await signInAs(page, rev);
    const res = await getJson(page, METRICS_PATH(u.unit_id));
    expect(res.status).toBe(200);
    const oracle = await expectedQuality(u.unit_id);
    const tiles = res.body.quality.tiles as { id: string; value: number | null; n: number; label: string }[];
    expect(tiles.map((t) => t.id)).toEqual(oracle.tiles.map((t) => t.id));
    expect(tiles).toHaveLength(16);
    for (const [i, t] of tiles.entries()) {
      expect({ id: t.id, value: t.value, n: t.n }, `tile ${t.id}`).toEqual(oracle.tiles[i]);
      expect(t.label).toBe(TILE_LABELS[t.id]);
      expect(t.label.length).toBeGreaterThan(0);
    }
    expect(res.body.quality.rating_counts).toEqual(oracle.rating_counts);
    expect(res.body.quality.seeded_errors).toEqual(oracle.seeded_errors);

    await openQuality(page, rev, u.unit_key);
    for (const t of tiles) {
      const text = await tileText(page, t.label);
      const o = oracle.tiles.find((x) => x.id === t.id)!;
      console.log(`tile ${t.id} route=${t.value} oracle=${o.value} screen=${text.replace(/\s+/g, " ")} n=${t.n}`);
      expect(text).toContain(`n = ${t.n}`);
      if (t.value === null) {
        expect(text).toContain(COPY.empty);
        expect(t.n).toBe(0);
        expect(text.replace(t.label, "").replace("n = 0", "")).not.toMatch(/\d/);
      } else {
        expect(text).toContain(String(t.value));
      }
    }
    if (name === "main") {
      expect(tiles.find((t) => t.id === "V-4")!.value).toBe(0.2); // hand-checked: 0, 1/5, 4/9, 1/5, 0
      expect(tiles.find((t) => t.id === "V-1")!.value).toBe(60);
      expect(tiles.find((t) => t.id === "H-3")!.value).toBe(90);
      expect(tiles.find((t) => t.id === "H-4")!.value).toBe(1.2); // newest http probe wins
    }
    if (name === "many") expect(tiles.find((t) => t.id === "H-1")!).toMatchObject({ value: null, n: 0 });
    if (name === "sparse") expect(tiles.find((t) => t.id === "O-3")!).toMatchObject({ value: null, n: 0 });
  });
}

test("tiles-equal-oracle: board link opens quality", async ({ page }) => {
  await signInAs(page, ids.reviewers[0]!);
  await page.goto("/units/g7-u1/board");
  await page.getByRole("link", { name: "Unit quality" }).click();
  await expect(page).toHaveURL(/\/units\/g7-u1\/quality$/);
  await expect(page.getByRole("heading", { name: COPY.title })).toBeVisible();
});
