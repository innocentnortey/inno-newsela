// NL-117 seed: the 3-lesson fixture (links inserted by SQL), the 47-lesson timing fixture and a synthetic odd-text standard.
// The expected matrix is NOT computed here: it is typed by hand in hand-count.json, which this file never imports.
import { insert_row } from "@ls/db/testing/insert-row";
import { db } from "../support/db";
import { createUser, type TestUser } from "../support/users";
import { seedLesson } from "../con-20/seed";
import { approverUser, ensureSeeded, freshUnit, seedApproved } from "../con-23/seed";

export { ensureSeeded, freshUnit };
export type Unit = { unit_id: string; unit_key: string };

const q = {
  query: async (text: string, values?: readonly unknown[]) => {
    const rows = await db().query(text, [...(values ?? [])]);
    return { rows, rowCount: rows.length };
  },
};

/** The content hash of the lesson's newest working document (what the matrix reads when nothing is approved). */
export async function workingHash(lesson_id: string): Promise<string> {
  const [r] = await db().query<{ content_hash: string }>("select content_hash from lesson_doc where lesson_id=$1 order by seq desc limit 1", [lesson_id]);
  return r!.content_hash;
}

type Link = { lesson_id: string; hash: string; code: string; role: "I" | "P" | "A"; by: "outline" | "generator" | "judge" | "reviewer"; confirmed: string | null };
let addr = 0;
async function link(l: Link): Promise<void> {
  addr += 1;
  await insert_row(q, "alignment_link", {
    lesson_id: l.lesson_id, content_hash: l.hash, code: l.code, address: `${l.lesson_id}.s${addr}`,
    role: l.role, origin: "outline", asserted_by: l.by, confirmed_by: l.confirmed,
  });
}

export interface ThreeLessons {
  unit: Unit;
  ids: { l3: string; l4: string; l5: string };
  decoy_hash: string;
  approved_hash: string;
  person: TestUser;
}

/** L3 and L5 working, L4 approved, plus two decoy links stored under L4's working hash. Rows follow the plan's table. */
export async function seedThreeLessons(): Promise<ThreeLessons> {
  await ensureSeeded();
  const have = await db().count("standard", "code in ('L.6.4.b','RL.6.1','RL.6.2','W.6.2.a')");
  if (have !== 4) throw new Error(`expected 4 seeded standards, found ${have}`);
  const unit = await freshUnit();
  const person = await createUser("reviewer");
  const approver = await approverUser();
  const l3 = await seedLesson({ unit, number: 3, state: "submitted", content: "wp1" });
  const l4 = await seedApproved({ unit, number: 4, approver_id: approver.user_id });
  const l5 = await seedLesson({ unit, number: 5, state: "submitted", content: "wp1" });
  const h3 = await workingHash(l3.lesson_id);
  const h4 = l4.approved.content_hash;
  const decoy = await workingHash(l4.lesson_id);
  const h5 = await workingHash(l5.lesson_id);
  const u = person.user_id;
  const L3 = l3.lesson_id, L4 = l4.lesson_id, L5 = l5.lesson_id;
  await link({ lesson_id: L3, hash: h3, code: "RL.6.1", role: "I", by: "outline", confirmed: null });
  await link({ lesson_id: L3, hash: h3, code: "L.6.4.b", role: "I", by: "generator", confirmed: null });
  await link({ lesson_id: L3, hash: h3, code: "L.6.4.b", role: "P", by: "judge", confirmed: null });
  await link({ lesson_id: L4, hash: h4, code: "RL.6.1", role: "I", by: "outline", confirmed: u });
  await link({ lesson_id: L4, hash: h4, code: "RL.6.1", role: "A", by: "outline", confirmed: u });
  await link({ lesson_id: L4, hash: h4, code: "RL.6.2", role: "I", by: "reviewer", confirmed: null });
  await link({ lesson_id: L4, hash: h4, code: "RL.6.2", role: "A", by: "judge", confirmed: null });
  await link({ lesson_id: L4, hash: h4, code: "L.6.4.b", role: "I", by: "generator", confirmed: null });
  await link({ lesson_id: L4, hash: h4, code: "L.6.4.b", role: "A", by: "generator", confirmed: null });
  await link({ lesson_id: L4, hash: decoy, code: "W.6.2.a", role: "A", by: "reviewer", confirmed: u });
  await link({ lesson_id: L4, hash: decoy, code: "L.6.4.d", role: "P", by: "reviewer", confirmed: u });
  await link({ lesson_id: L5, hash: h5, code: "RL.6.2", role: "P", by: "reviewer", confirmed: null });
  await link({ lesson_id: L5, hash: h5, code: "L.6.4.b", role: "P", by: "generator", confirmed: null });
  await link({ lesson_id: L5, hash: h5, code: "W.6.2.a", role: "I", by: "generator", confirmed: null });
  await link({ lesson_id: L5, hash: h5, code: "W.6.2.a", role: "P", by: "generator", confirmed: null });
  return { unit, ids: { l3: L3, l4: L4, l5: L5 }, decoy_hash: decoy, approved_hash: h4, person };
}

/** 47 lessons (9 with an approve snapshot) and about 280 links in one bulk insert. Timing only; nothing is hand counted. */
export async function seedFortySeven(): Promise<Unit> {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  const approved = new Set([2, 7, 12, 17, 22, 27, 32, 37, 42]);
  for (let n = 1; n <= 47; n++) {
    if (approved.has(n)) await seedApproved({ unit, number: n, approver_id: approver.user_id });
    else await seedLesson({ unit, number: n, state: "draft", content: "wp1" });
  }
  const codes = (await db().query<{ code: string }>("select code from standard where is_leaf order by code limit 12")).map((r) => r.code);
  if (codes.length !== 12) throw new Error("need 12 seeded leaf standards");
  await db().query(
    `insert into alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by)
     select l.id,
            coalesce((select v.content_hash from lesson_version v where v.lesson_id=l.id and v.kind='approve' order by v.number desc limit 1),
                     (select d.content_hash from lesson_doc d where d.lesson_id=l.id order by d.seq desc limit 1)),
            ($2::text[])[1 + ((l.number + k) % 12)], l.id || '.b' || k,
            (array['I','P','A'])[1 + (k % 3)], 'outline', (array['generator','judge','reviewer','outline'])[1 + (k % 4)], null
       from lesson l cross join generate_series(0, 5) k where l.unit_id = $1`,
    [unit.unit_id, codes],
  );
  return unit;
}

export const WEIRD_CODE = "ZZ.E2E.1";
export const WEIRD_TEXT = "<b>x</b> synthetic";

/** A synthetic standard whose official text looks like markup, with one working-hash link on `lesson_id`. Remove with dropWeirdStandard. */
export async function weirdStandard(lesson_id: string): Promise<void> {
  await insert_row(q, "standard", { code: WEIRD_CODE, set: "e2e", text: WEIRD_TEXT, parent_code: null, is_leaf: true, eld_strand: null });
  await link({ lesson_id, hash: await workingHash(lesson_id), code: WEIRD_CODE, role: "I", by: "reviewer", confirmed: null });
}
export async function dropWeirdStandard(): Promise<void> {
  await db().query("delete from alignment_link where code=$1", [WEIRD_CODE]);
  await db().query("delete from standard where code=$1", [WEIRD_CODE]);
}
