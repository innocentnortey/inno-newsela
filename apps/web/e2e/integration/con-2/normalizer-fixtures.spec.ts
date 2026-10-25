// NL-93 AC-5: SYN-2 normalizes to the issued layout; SYN-3 row 10 is clean; no model call.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { ISSUED_CSV, SYN2_CSV, SYN3_CSV } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { fromPath, postOutline, rowsFor } from "./support/upload";

// SYN-2 shifts the title block (kind "meta") and ships a blank total row, so only lesson, flex-day and arc-header rows are compared.
const keep = (r: { kind: string }) => r.kind !== "total" && r.kind !== "meta";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("normalizer-fixtures: SYN-2 matches the issued layout; SYN-3 row 10 is clean; no model call", async ({
  page,
}) => {
  await signInAs(page, await createUser("author"));
  const base = getStack().baseURL;
  const modelBefore = await db().count("model_call");

  const a = await postOutline(page, base, fromPath(ISSUED_CSV));
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  const issued = (await rowsFor(a.body.outline_version_id)).filter(keep);
  await resetIntake();

  const b = await postOutline(page, base, fromPath(SYN2_CSV));
  expect(b.status, JSON.stringify(b.body)).toBe(201);
  const syn2 = (await rowsFor(b.body.outline_version_id)).filter(keep);
  const shape = (rs: typeof issued) =>
    rs.map((r) => [r.kind, r.lesson_id, r.row_hash]);
  expect(shape(syn2)).toEqual(shape(issued));
  const rep2 = await (
    await page.request.get(
      `/api/outline-versions/${b.body.outline_version_id}/report`,
    )
  ).json();
  expect(rep2.counts.lessons).toBe(41);
  expect(rep2.counts.flex_days).toBe(6);
  expect(rep2.counts.arc_headers).toBe(7);
  await resetIntake();

  const c = await postOutline(page, base, fromPath(SYN3_CSV));
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const rep3 = await (
    await page.request.get(
      `/api/outline-versions/${c.body.outline_version_id}/report`,
    )
  ).json();
  const row10 = rep3.rows.find(
    (r: { row_number: number }) => r.row_number === 10,
  );
  expect(row10.level).toBe("ok");
  expect(row10.findings).toEqual([]);

  expect(await db().count("model_call")).toBe(modelBefore);
});
