import { describe, expect, it } from "vitest";
import { buildNav, pickRecentUnitKey, unitKeyFromPath } from "@/features/frame/nav";

const labels = (role: Parameters<typeof buildNav>[0], path = "/units", fired?: number[]) =>
  buildNav(role, path, fired)[0]!.items.map((i) => i.label);

describe("buildNav", () => {
  it("gives the author Prompt guidance", () => expect(labels("author")).toEqual(["Units", "Unit board", "Prompt guidance"]));
  it("hides Prompt guidance from reviewer and approver", () => {
    expect(labels("reviewer")).toEqual(["Units", "Unit board"]);
    expect(labels("approver")).toEqual(["Units", "Unit board"]);
  });
  it("drops Prompt guidance once cut 7 has fired", () => expect(labels("author", "/", [7])).toEqual(["Units", "Unit board"]));
  it("marks only the longest matching entry", () => {
    const cur = (p: string) => buildNav("reviewer", p, undefined, "g6-u4")[0]!.items.filter((i) => i.current).map((i) => i.id);
    expect(cur("/units/g6-u4/board")).toEqual(["board"]);
    expect(cur("/units")).toEqual(["units"]);
    expect(cur("/units/g6-u4/lessons/L5/approval")).toEqual(["units"]);
    expect(cur("/elsewhere")).toEqual([]);
  });
});

const board = (key: string | null, path = "/units") => buildNav("reviewer", path, undefined, key)[0]!.items.find((i) => i.id === "board")!;

describe("board link", () => {
  it("points at the unit key it is given", () => expect(board("g7-u2").href).toBe("/units/g7-u2/board"));
  it("encodes the key", () => expect(board("a b").href).toBe("/units/a%20b/board"));
  it("falls back to /units with no key, and Units stays the only current entry", () => {
    expect(board(null).href).toBe("/units");
    const cur = buildNav("reviewer", "/units", undefined, null)[0]!.items.filter((i) => i.current).map((i) => i.id);
    expect(cur).toEqual(["units"]);
    expect(buildNav("reviewer", "/units/x/board", undefined, null)[0]!.items.filter((i) => i.current).map((i) => i.id)).toEqual(["units"]);
  });
  it("keeps the label when it falls back", () => expect(board(null).label).toBe("Unit board"));
});

describe("unitKeyFromPath", () => {
  it.each([
    ["/units/g6-u4/board", "g6-u4"],
    ["/units/g6-u4/lessons/L5", "g6-u4"],
    ["/units/g6-u4", "g6-u4"],
    ["/units", null],
    ["/units/", null],
    ["/elsewhere", null],
    ["/units/a%20b/board", "a b"],
  ])("%s -> %s", (path, key) => expect(unitKeyFromPath(path)).toBe(key));
});

describe("pickRecentUnitKey", () => {
  const u = (unit_key: string, dates: string[], run = false) => ({
    unit_key, versions: dates.map((created_at) => ({ created_at })), latest_run: run ? { run_id: "r" } : null,
  });
  it("picks the unit with the newest version", () =>
    expect(pickRecentUnitKey([u("g6-u4", ["2026-10-01T00:00:00Z"]), u("g7-u2", ["2026-09-01T00:00:00Z", "2026-10-20T00:00:00Z"])])).toBe("g7-u2"));
  it("breaks a tie toward the unit with a run, then the first", () => {
    const d = ["2026-10-01T00:00:00Z"];
    expect(pickRecentUnitKey([u("a", d), u("b", d, true)])).toBe("b");
    expect(pickRecentUnitKey([u("a", d), u("b", d)])).toBe("a");
  });
  it("returns null for an empty list", () => expect(pickRecentUnitKey([])).toBeNull());
});
