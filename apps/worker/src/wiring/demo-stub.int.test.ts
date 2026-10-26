// S-28b: the built-in demo script drives a started run to stored draft lessons through the production wiring defaults
// (no test price lookup, no per-test script): this is the path a Compose stack in stub mode takes.
import Decimal from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { make_world, World } from "../../test/support/world.ts";
import { script_demo_stub } from "./demo-stub.ts";
import { wire_generation } from "./generation.ts";

const worlds: World[] = [];
afterEach(async () => {
  for (const w of worlds.splice(0)) await w.close();
});

describe("demo stub", () => {
  it("a confirmed outline plus a started run (rows 8, 9, 25, cap $5) reaches draft lessons with no failed jobs", async () => {
    const w = await make_world();
    worlds.push(w);
    script_demo_stub(w.stub);
    const wiring = wire_generation(w.deps); // no prices option: the stub-mode default prices stub-model
    const run_id = await w.start_run([8, 9, 25], 5);
    expect(await w.drive_until(() => w.run_finished(run_id), 60_000, wiring.claim_loop)).toBe(true);

    const lessons = await w.query<{ state: string }>("select state from lesson where id = any($1) order by id", [["G6.U4.L4", "G6.U4.L5", "G6.U4.FLEX-1a"]]);
    expect(lessons.map((l) => l.state)).toEqual(["draft", "draft", "draft"]);
    const failed = await w.query("select 1 from lesson_job where run_id=$1 and status='failed'", [run_id]);
    expect(failed).toHaveLength(0);
    expect(w.stub.calls.length).toBeGreaterThan(0);
    const spent = await w.query<{ s: string }>("select coalesce(sum(settled_usd),0)::text as s from spend_reservation where run_id=$1", [run_id]);
    expect(new Decimal(spent[0]!.s).gt(0)).toBe(true);
    expect(new Decimal(spent[0]!.s).lte(5)).toBe(true);
  }, 90_000);
});
