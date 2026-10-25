// NL-95: the DAY_CAP_REACHED banner names the amount left when the server sends remaining_usd (CON-5).
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartRunDialog } from "@/features/start-run/start-run-dialog";
import { ApiError } from "@/lib/api-client";

vi.mock("@/features/start-run/use-navigate", () => ({ useNavigate: () => vi.fn() }));
const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

const PROMPT = {
  current_prompt_version_id: "pv-1",
  locked_layer: { version_id: "locked-1", text: "x" },
  guidance_versions: [{ version_id: "guidance-1", number: 1, author: "A", created_at: "2026-10-25T14:00:00Z", reason: "r", diff: "", pinned_by_runs: [] }],
};
beforeEach(() => {
  GET.mockImplementation(async (path: string) => (path === "/prompt-versions" ? { data: PROMPT } : { data: { counts: { teaching_days: 47, errors_unconfirmed: 0 }, rows: [8, 9, 25].map((row_number) => ({ row_number, kind: "lesson" })) } }));
});
afterEach(() => {
  cleanup();
  GET.mockReset();
  POST.mockReset();
});

describe("DAY_CAP_REACHED banner", () => {
  for (const [left, title] of [
    [6, "Daily spend cap reached. $6.00 left today. No run can start until tomorrow."],
    [0.5, "Daily spend cap reached. $0.50 left today. No run can start until tomorrow."],
    [null, "Daily spend cap reached. No run can start until tomorrow."],
  ] as const) {
    it(`remaining_usd ${String(left)} reads "${title}"`, async () => {
      POST.mockRejectedValue(new ApiError({ status: 422, code: "DAY_CAP_REACHED", message: "m", details: { scope: "user", remaining_usd: left } }));
      render(<StartRunDialog outlineVersionId="G6.U4.ov1" open onClose={vi.fn()} />);
      await screen.findByText(/pinned to this run/);
      await userEvent.click(screen.getByRole("button", { name: "Start run" }));
      expect(await screen.findByText(title)).toBeInTheDocument();
    });
  }
});
