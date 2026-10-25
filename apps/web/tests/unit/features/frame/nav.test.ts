import { describe, expect, it } from "vitest";
import { buildNav } from "@/features/frame/nav";

const labels = (role: Parameters<typeof buildNav>[0], path = "/units", fired?: number[]) =>
  buildNav(role, path, fired)[0]!.items.map((i) => i.label);

describe("buildNav", () => {
  it("gives the author Prompt guidance", () => expect(labels("author")).toEqual(["Units", "Unit board", "Prompt guidance"]));
  it("hides Prompt guidance from reviewer and approver", () => {
    expect(labels("reviewer")).toEqual(["Units", "Unit board"]);
    expect(labels("approver")).toEqual(["Units", "Unit board"]);
  });
  it("drops Prompt guidance once cut 7 has fired", () => expect(labels("author", "/", [7])).toEqual(["Units", "Unit board"]));
  it("marks the current entry by path prefix", () => {
    const items = buildNav("reviewer", "/units/g6-u4/board")[0]!.items;
    expect(items.filter((i) => i.current).map((i) => i.id)).toEqual(["units", "board"]);
  });
});
