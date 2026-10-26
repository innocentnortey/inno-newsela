import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PASSWORD } from "@ls/core/auth/demo-accounts";
import { SignInScreen } from "@/features/sign-in/sign-in-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: () => Promise.resolve({ data: undefined }), POST: vi.fn() },
}));
afterEach(cleanup);

describe("SignInScreen demo accounts", () => {
  it("shows the box only when the flag is on", () => {
    render(<SignInScreen showDemoAccounts />);
    expect(screen.getByRole("heading", { name: "Demo accounts" })).toBeTruthy();
    expect(screen.getByText("author.demo@example.test")).toBeTruthy();
    expect(screen.getByText(`Password for all three: ${DEMO_PASSWORD}`)).toBeTruthy();
    cleanup();
    render(<SignInScreen />);
    expect(screen.queryByRole("heading", { name: "Demo accounts" })).toBeNull();
  });
});
