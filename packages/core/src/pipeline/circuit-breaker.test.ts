import { describe, expect, it } from "vitest";
import { should_pause_run, type TerminalJobView } from "./circuit-breaker.ts";
import type { CheckKind } from "./state.ts";

const K: CheckKind = "minutes_out_of_range";
const j = (
  id: string,
  t: number,
  status: TerminalJobView["status"] = "generation_failed",
  kind: CheckKind | null = K,
): TerminalJobView => ({
  lesson_id: id,
  status,
  first_failing_kind: kind,
  finished_at: t,
});

describe("should_pause_run", () => {
  it("pauses on 3 same", () => {
    expect(should_pause_run([j("a", 1), j("b", 2), j("c", 3)], 3)).toEqual({
      pause: true,
      check: K,
      lesson_ids: ["c", "b", "a"],
    });
  });
  it("no pause with 2 same + 1 different", () => {
    expect(
      should_pause_run(
        [j("a", 1, "generation_failed", "judge_no"), j("b", 2), j("c", 3)],
        3,
      ).pause,
    ).toBe(false);
  });
  it("no pause when a ready is among the three", () => {
    expect(
      should_pause_run([j("a", 1), j("b", 2, "ready", null), j("c", 3)], 3)
        .pause,
    ).toBe(false);
  });
  it("ignores cancelled", () => {
    const three = [j("a", 1), j("b", 2), j("c", 3)];
    expect(should_pause_run([j("x", 9, "cancelled"), ...three], 3).pause).toBe(
      true,
    );
    expect(
      should_pause_run([j("x", 9, "cancelled"), j("b", 2), j("c", 3)], 3).pause,
    ).toBe(false);
  });
  it("no pause with fewer than threshold", () => {
    expect(should_pause_run([j("a", 1), j("b", 2)], 3)).toEqual({
      pause: false,
      check: null,
      lesson_ids: [],
    });
  });
  it("breaks finished_at ties by lesson_id and does not mutate", () => {
    const input = [j("c", 5), j("a", 5), j("b", 5), j("z", 1)];
    const copy = [...input];
    expect(should_pause_run(input, 3).lesson_ids).toEqual(["a", "b", "c"]);
    expect(input).toEqual(copy);
  });
  it("honours threshold 2", () => {
    expect(
      should_pause_run([j("a", 1, "ready", null), j("b", 2), j("c", 3)], 2)
        .pause,
    ).toBe(true);
  });
  it("null kind does not pause", () => {
    expect(
      should_pause_run(
        [
          j("a", 1, "generation_failed", null),
          j("b", 2, "generation_failed", null),
          j("c", 3, "generation_failed", null),
        ],
        3,
      ).pause,
    ).toBe(false);
  });
});
