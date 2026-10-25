// NL-102 AC-5: the downloaded file validates against the published schema, and one hash identity ties list, download and row together.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { as, bundleHash, createExport, download, exportRows, listExports, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, seedApproved } from "./seed";

test.setTimeout(300_000);
const SCHEMA = resolve(__dirname, "../../../../../docs/contracts/lesson-export.schema.json");

test("schema-and-hashes: Ajv accepts the file and payload_hash is the same everywhere", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  await seedApproved({ unit, number: 2, approver_id: approver.user_id });
  await as(page, approver);
  const c = (await (await createExport(page, unit.unit_key)).json()) as Created;
  const file = await download(page, c.export_id);

  const { default: Ajv } = (await import("ajv/dist/2020.js")) as unknown as { default: new (o: object) => { compile: (s: object) => ((d: unknown) => boolean) & { errors?: unknown[] | null } } };
  const validate = new Ajv({ strict: false, validateFormats: false }).compile(JSON.parse(readFileSync(SCHEMA, "utf8")) as object);
  const ok = validate(file.body);
  expect(validate.errors ?? [], JSON.stringify(validate.errors)).toEqual([]);
  expect(ok).toBe(true);

  const listed = (await listExports(page, unit.unit_key)).exports[0]!.payload_hash;
  const stored = (await exportRows(unit.unit_id))[0]!.payload_sha256;
  const computed = bundleHash(file.body);
  console.log(`hashes: download=${computed} list=${listed} row=${stored}`);
  expect(computed).toBe(listed);
  expect(listed).toBe(stored);

  for (const l of file.body.lessons) {
    const [row] = await db().query<{ content_hash: string }>("select content_hash from lesson_version where id=$1 and kind='approve'", [l.version_id]);
    expect(l.content_hash).toBe(row!.content_hash);
  }

  const again = await createExport(page, unit.unit_key);
  expect(again.status()).toBe(200);
  const file2 = await download(page, ((await again.json()) as Created).export_id);
  expect(file2.body.lessons).toEqual(file.body.lessons);
});
