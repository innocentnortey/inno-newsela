import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartRunDialog } from "@/features/start-run/start-run-dialog";
import { ApiError } from "@/lib/api-client";

const navigate = vi.fn();
vi.mock("@/features/start-run/use-navigate", () => ({ useNavigate: () => navigate }));
const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

const PROMPT = {
  current_prompt_version_id: "pv-locked1-guidance1",
  locked_layer: { version_id: "locked-1", text: "x" },
  guidance_versions: [{ version_id: "guidance-1", number: 1, author: "Author (demo)", created_at: "2026-10-25T14:00:00Z", reason: "First guidance", diff: "", pinned_by_runs: [] }],
};
const REPORT = {
  counts: { teaching_days: 47, errors_unconfirmed: 5 },
  rows: [8, 9, 25].map((row_number) => ({ row_number, kind: "lesson" })),
};
const err = (code: ApiError["code"], details: Record<string, unknown> = {}) =>
  new ApiError({ status: 422, code, message: "msg", details });

let promptGate: Promise<void> = Promise.resolve();
beforeEach(() => {
  navigate.mockReset();
  POST.mockReset();
  GET.mockReset();
  promptGate = Promise.resolve();
  GET.mockImplementation(async (path: string) => {
    if (path === "/prompt-versions") {
      await promptGate;
      return { data: PROMPT };
    }
    return { data: REPORT };
  });
});
afterEach(cleanup);

const setup = (onClose = vi.fn()) => {
  render(<StartRunDialog outlineVersionId="G6.U4.ov1" open onClose={onClose} />);
  return onClose;
};
const start = () => screen.getByRole("button", { name: "Start run" });
const ready = () => screen.findByText("v1 · locked rules + guidance v1 · pinned to this run");

describe("StartRunDialog", () => {
  it("shows the skeleton until prompt versions load", async () => {
    let release!: () => void;
    promptGate = new Promise((r) => (release = r));
    setup();
    expect(screen.getByTestId("prompt-skeleton")).toBeInTheDocument();
    release();
    await ready();
    expect(screen.queryByTestId("prompt-skeleton")).toBeNull();
  });

  it("focus lands on the checked Scope radio", async () => {
    setup();
    await waitFor(() => expect(screen.getByRole("radio", { name: "Chosen rows" })).toHaveFocus());
  });

  it("success posts the body and navigates", async () => {
    POST.mockResolvedValue({ data: { run_id: "run-0001" } });
    const onClose = setup();
    await ready();
    const cap = screen.getByLabelText("Spend cap (dollars)");
    await userEvent.clear(cap);
    await userEvent.type(cap, "5");
    await userEvent.click(start());
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    expect(POST.mock.calls[0]![0]).toBe("/runs");
    expect(POST.mock.calls[0]![1].body).toEqual({
      outline_version_id: "G6.U4.ov1",
      mode: "run",
      scope: { kind: "rows", rows: [8, 9, 25] },
      prompt_version_id: "pv-locked1-guidance1",
      cap_usd: 5,
    });
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/units/g6-u4/runs/run-0001");
  });

  it("cap 0 and empty block the call", async () => {
    setup();
    await ready();
    const cap = screen.getByLabelText("Spend cap (dollars)");
    for (const v of ["0", ""]) {
      await userEvent.clear(cap);
      if (v) await userEvent.type(cap, v);
      await userEvent.click(start());
      expect(await screen.findByText("Set a cap above $0")).toBeInTheDocument();
      expect(cap).toHaveFocus();
    }
    expect(POST).not.toHaveBeenCalled();
  });

  it("row 52 blocks the call", async () => {
    setup();
    await ready();
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(2));
    const rows = screen.getByLabelText("Rows");
    await userEvent.clear(rows);
    await userEvent.type(rows, "52");
    await userEvent.click(start());
    expect(await screen.findByText("Row 52 isn't a teaching day in this outline")).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });

  for (const [code, title, details] of [
    ["VALIDATION_INCOMPLETE", "Confirm the report first: 1 error still to confirm.", { errors_unconfirmed: 1 }],
    ["DAY_CAP_REACHED", "Daily spend cap reached. No run can start until tomorrow.", {}],
    ["ROLE_FORBIDDEN", "Only authors can start a run.", {}],
  ] as const) {
    it(`${code} shows its banner and takes focus`, async () => {
      POST.mockRejectedValue(err(code, details));
      setup();
      await ready();
      await userEvent.click(start());
      const text = await screen.findByText(title, { exact: false });
      const box = screen.getByRole("alert").parentElement!;
      expect(text).toBeInTheDocument();
      expect(box).toHaveFocus();
    });
  }

  it("VALIDATION_INCOMPLETE link closes the dialog", async () => {
    POST.mockRejectedValue(err("VALIDATION_INCOMPLETE", { errors_unconfirmed: 1 }));
    const onClose = setup();
    await ready();
    await userEvent.click(start());
    await userEvent.click(await screen.findByRole("link", { name: "Show me the error" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Start run is disabled until the prompt version is ready", async () => {
    let release!: () => void;
    promptGate = new Promise((r) => (release = r));
    setup();
    expect(start()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("The prompt version is still loading.")).toBeInTheDocument();
    release();
    await ready();
    expect(start()).not.toHaveAttribute("aria-disabled");
  });
});
