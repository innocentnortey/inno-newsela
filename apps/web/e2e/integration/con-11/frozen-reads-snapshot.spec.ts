// NL-100 AC-4 (R-33): a submitted or approved lesson is read from its snapshot; the live document row is not read.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import { getLesson } from "./helpers";
import { seed, writeSnapshot } from "./seed";

for (const key of ["submitted", "approved"] as const) {
  test(`frozen-reads-snapshot: ${key} lesson ignores a live-document edit until a new snapshot exists`, async ({
    page,
  }) => {
    const s = await seed();
    const id = s.lessons[key];
    await signInAs(page, "reviewer");
    const first = await getLesson(page, id);
    expect(first.status).toBe(200);
    expect(first.body.snapshot).not.toBeNull();
    const snap = first.body.snapshot!;
    expect(snap.version_id).toMatch(/^lv_/);
    expect(first.body.content_hash).toBe(snap.content_hash);
    expect(snap.state_vector.length).toBeGreaterThan(0);
    expect(Array.isArray(first.body.checklist)).toBe(true);
    expect(first.body.checklist.length).toBeGreaterThan(0);

    // As the collab server would: a newer live document row with another minutes value and hash.
    await db().query(
      `insert into lesson_doc (lesson_id, seq, store_id, ydoc_bytes, derived_json, content_hash, state_vector, schema_version)
       select lesson_id, seq + 1, store_id || 'x', ydoc_bytes, jsonb_set(derived_json, '{sections,0,minutes}', '99'),
              repeat('e', 64), state_vector, schema_version
         from lesson_doc where lesson_id = $1 order by seq desc limit 1`,
      [id],
    );
    const live = await db().query<{ m: number }>(
      "select (derived_json #>> '{sections,0,minutes}')::int as m from lesson_doc where lesson_id=$1 order by seq desc limit 1",
      [id],
    );
    expect(live[0]!.m).toBe(99);

    const second = await getLesson(page, id);
    expect(second.body).toEqual(first.body);
    expect(second.body.content_hash).toBe(snap.content_hash);
    expect(second.body.sections[0]!.minutes).not.toBe(99);

    // A new snapshot is the only thing that moves the response.
    const next = writeSnapshot(id);
    const third = await getLesson(page, id);
    expect(third.body.snapshot!.version_id).toBe(next.version_id);
    expect(third.body.content_hash).toBe(next.content_hash);
    expect(third.body.content_hash).not.toBe(snap.content_hash);
    expect(third.body.sections[0]!.minutes).toBe(77);
  });
}
