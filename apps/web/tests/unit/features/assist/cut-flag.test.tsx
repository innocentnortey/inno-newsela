import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assistEnabled } from "@/features/assist/cut";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../../../../app/(dev)/gallery/guard", () => ({ galleryEnabled: () => true }));

afterEach(() => vi.resetModules());

describe("cut #8 flag", () => {
  it("assistEnabled is true with no fired cuts", () => {
    expect(assistEnabled([])).toBe(true);
  });
  it("assistEnabled is false when cut 8 fired", () => {
    expect(assistEnabled([8])).toBe(false);
  });
  it("harness page is a 404 when cut 8 fired", async () => {
    vi.doMock("@/features/frame/nav", () => ({ FIRED_CUTS: [8] }));
    const { default: Page } = await import("../../../../app/(dev)/harness/assist/page");
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
    vi.doUnmock("@/features/frame/nav");
  });
  it("nothing in nav imports assist", () => {
    const nav = readFileSync(path.join(import.meta.dirname, "../../../../src/features/frame/nav.ts"), "utf8");
    expect(nav).not.toMatch(/assist/i);
  });
});
