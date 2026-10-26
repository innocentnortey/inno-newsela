import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tile } from "@/features/quality/tile";

afterEach(cleanup);
const r = (tile: Parameters<typeof Tile>[0]["tile"]) =>
  render(
    <ul>
      <Tile tile={tile} />
    </ul>,
  ).container;

describe("tile", () => {
  it("n 0 and null value shows the words and n = 0, no other digit", () => {
    const c = r({ id: "V-1", value: null, n: 0, label: "Usable" });
    expect(c.textContent).toContain("No approved lessons yet");
    expect(c.textContent).toContain("n = 0");
    expect((c.textContent ?? "").replace("n = 0", "")).not.toMatch(/\d/);
  });
  it("n 0 wins over a value", () => {
    const c = r({ id: "V-1", value: 5, n: 0, label: "Usable" });
    expect(c.textContent).not.toContain("5");
    expect(c.textContent).toContain("No approved lessons yet");
  });
  it("a real zero prints 0", () => {
    const c = r({ id: "V-5", value: 0, n: 3, label: "Rewritten" });
    expect(c.textContent).toContain("0");
    expect(c.textContent).not.toContain("No approved lessons yet");
  });
  it("known id shows its unit, unknown id none", () => {
    expect(r({ id: "V-1", value: 66.7, n: 3, label: "x" }).textContent).toContain("66.7 %");
    cleanup();
    expect(r({ id: "Z-9", value: 4, n: 3, label: "x" }).textContent).toBe("x4n = 3");
  });
});
