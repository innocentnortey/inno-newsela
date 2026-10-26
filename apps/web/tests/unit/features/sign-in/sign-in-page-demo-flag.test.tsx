import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInPage from "../../../../app/sign-in/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: () => Promise.resolve({ data: undefined }), POST: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("sign-in page DEMO_ACCOUNTS flag", () => {
  it("shows the box with DEMO_ACCOUNTS=1", () => {
    vi.stubEnv("DEMO_ACCOUNTS", "1");
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: "Demo accounts" })).toBeTruthy();
  });
  it("hides the box when the flag is unset", () => {
    vi.stubEnv("DEMO_ACCOUNTS", "");
    vi.stubEnv("NEXT_PUBLIC_DEMO_ACCOUNTS", "");
    render(<SignInPage />);
    expect(screen.queryByRole("heading", { name: "Demo accounts" })).toBeNull();
  });
});
