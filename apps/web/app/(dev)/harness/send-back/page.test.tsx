import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));
vi.mock("next/navigation", () => ({ notFound, useSearchParams: () => new URLSearchParams(), usePathname: () => "/", useRouter: () => ({ replace: () => {} }) }));

afterEach(() => vi.unstubAllEnvs());

describe("send-back harness", () => {
  it("is a 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: Page } = await import("./page");
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
