// NL-93 probe: does a real upload work at all (standards files resolvable in the built bundle)?
import { expect, test } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { ISSUED_XLSX } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { fromPath, postOutline } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("stack-probe: seeded author uploads the issued xlsx through the API and gets 201", async ({
  page,
}) => {
  await signInAs(page, await createUser("author"));
  const r = await postOutline(page, getStack().baseURL, fromPath(ISSUED_XLSX));
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  expect(r.body.version_number).toBe(1);
});
