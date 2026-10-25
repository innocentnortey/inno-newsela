import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { SessionGate } from "@/features/frame/session-gate";
import { useSession } from "@/features/frame/session-context";
import { ApiError } from "@/lib/api-client";
import { SESSIONS } from "@/test-utils/fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/units",
  useSearchParams: () => new URLSearchParams(),
}));
const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), api: { GET: (...a: unknown[]) => GET(...a) } }));

function Who() {
  const { user, role } = useSession();
  return <p>{`${user.name} / ${role}`}</p>;
}

beforeEach(() => {
  replace.mockReset();
  GET.mockReset();
});

afterEach(cleanup);

describe("SessionGate", () => {
  it("redirects to sign-in with next on 401", async () => {
    GET.mockRejectedValue(new ApiError({ status: 401, code: "UNAUTHENTICATED", message: "x" }));
    render(<SessionGate><Who /></SessionGate>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in?next=%2Funits"));
  });
  it("renders children with the session on 200", async () => {
    GET.mockResolvedValue({ data: SESSIONS.reviewer });
    render(<SessionGate><Who /></SessionGate>);
    expect(await screen.findByText("Reviewer A (demo) / reviewer")).toBeInTheDocument();
  });
  it("offers Retry when the session cannot load", async () => {
    GET.mockRejectedValueOnce(new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" }));
    GET.mockResolvedValueOnce({ data: SESSIONS.author });
    render(<SessionGate><Who /></SessionGate>);
    expect(await screen.findByText("Couldn't load your session. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Author (demo) / author")).toBeInTheDocument();
    expect(GET).toHaveBeenCalledTimes(2);
  });
});
