import { afterEach, describe, expect, it, vi } from "vitest";
import { assistEnabled } from "@/features/assist/cut";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));
vi.mock("next/navigation", () => ({ notFound, useSearchParams: () => new URLSearchParams(), usePathname: () => "/", useRouter: () => ({ replace: () => {} }) }));

afterEach(() => vi.unstubAllEnvs());

describe("assist harness", () => {
  it("is a 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: Page } = await import("./page");
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
  it("is a 404 when cut 8 has fired", () => {
    expect(assistEnabled([8])).toBe(false);
    expect(assistEnabled([4])).toBe(true);
  });
});
