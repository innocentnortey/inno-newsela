import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadOutlineScreen } from "@/features/upload-outline/upload-outline-screen";
import { ApiError } from "@/lib/api-client";
import { renderWithSession } from "@/test-utils/render-with-session";
import type { Role } from "@/lib/roles";
import type { components } from "@/lib/api-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), api: { POST: (...a: unknown[]) => POST(...a) } }));
const flag = vi.hoisted(() => ({ on: true }));
vi.mock("@/features/upload-outline/flags", () => ({
  get LINK_IMPORT_ENABLED() {
    return flag.on;
  },
}));

type OV = components["schemas"]["OutlineVersion"];
const first = {
  outline_version_id: "G6.U4.ov1", unit_id: "G6.U4", unit_key: "g6-u4", version_number: 1,
  sha256: "a1".padEnd(64, "0"), same_as_version: null, changed_lessons: 0,
  row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
  created_at: "2026-10-25T14:50:00Z", created_by: "Author (demo)",
} as unknown as OV;
const same = { ...first, version_number: 2, same_as_version: 1 } as OV;
const apiErr = (code: ConstructorParameters<typeof ApiError>[0]["code"]) => new ApiError({ status: 422, code, message: "x" });

const setup = (role: Role = "author") => renderWithSession(<UploadOutlineScreen unitKey="g6-u4" />, role);
const pick = (container: HTMLElement, name = "g6-u4-outline.xlsx") =>
  fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [new File(["x"], name)] } });
const toLink = async () => {
  await userEvent.click(screen.getByLabelText("Sheet link"));
  await userEvent.type(screen.getByLabelText("Google Sheet link"), "https://docs.google.com/spreadsheets/d/EXAMPLE-SYNTHETIC-ID/edit");
  await userEvent.click(screen.getByRole("button", { name: "Import" }));
};

beforeEach(() => {
  push.mockReset();
  POST.mockReset();
  flag.on = true;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("UploadForm", () => {
  it("loading_stages", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    POST.mockReturnValue(new Promise(() => {}));
    const { container } = setup();
    pick(container);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Upload" })).toHaveAttribute("aria-busy", "true");
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Reading rows…")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(9000); });
    expect(screen.getByText("Reading rows · Checking codes")).toBeInTheDocument();
  });

  it("error_keeps_input_and_focuses_message", async () => {
    POST.mockRejectedValue(apiErr("SHEET_NOT_PUBLIC"));
    setup();
    await toLink();
    expect(screen.getByLabelText("Google Sheet link")).toHaveValue("https://docs.google.com/spreadsheets/d/EXAMPLE-SYNTHETIC-ID/edit");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByTestId("upload-error"));
  });

  it("retry_resubmits", async () => {
    POST.mockRejectedValueOnce(apiErr("SHEET_UNREACHABLE")).mockResolvedValueOnce({ data: same });
    setup();
    await toLink();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(POST).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Version 2 is the same as version 1/)).toBeInTheDocument();
  });

  it("no_file_no_call", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("Choose a file first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose file" })).toHaveFocus();
  });

  it("extension_check_only", () => {
    const { container } = setup();
    pick(container, "a.pdf");
    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("This file type isn't supported. Upload a CSV or XLSX file.")).toBeInTheDocument();
    expect(screen.queryByTestId("chosen-file")).toBeNull();
  });

  it("success_navigates", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    POST.mockResolvedValue({ data: first });
    const { container } = setup();
    pick(container);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await act(async () => {});
    expect(screen.getByText(/Grade 6 · Unit 4 · version 1 · 41 lessons/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(push).toHaveBeenCalledWith("/units/g6-u4/outlines/1");
  });

  it("same_hash_no_navigation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    POST.mockResolvedValue({ data: same });
    const { container } = setup();
    pick(container);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getAllByText(/Version 2 is the same as version 1; 0 lessons changed\./).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open the report" })).toHaveAttribute("href", "/units/g6-u4/outlines/2");
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["reviewer", "approver"] as const)("non_author_sees_no_controls %s", (role) => {
    const { container } = setup(role);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelector("input")).toBeNull();
    expect(screen.getByText("Only authors can upload an outline")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the board" })).toHaveAttribute("href", "/units/g6-u4/board");
  });

  it("link_flag_off_hides_switch", () => {
    flag.on = false;
    setup();
    expect(screen.queryByLabelText("Sheet link")).toBeNull();
    expect(screen.getByRole("button", { name: "Choose file" })).toBeInTheDocument();
  });

  it("switch_keeps_other_input", async () => {
    const { container } = setup();
    pick(container);
    await userEvent.click(screen.getByLabelText("Sheet link"));
    await userEvent.type(screen.getByLabelText("Google Sheet link"), "https://x.example/y");
    await userEvent.click(screen.getByLabelText("File"));
    expect(screen.getByTestId("chosen-file")).toHaveTextContent("g6-u4-outline.xlsx");
    await userEvent.click(screen.getByLabelText("Sheet link"));
    expect(screen.getByLabelText("Google Sheet link")).toHaveValue("https://x.example/y");
  });

  it("renders_names_as_text", () => {
    const { container } = setup();
    pick(container, "<b>x</b>.csv");
    expect(screen.getByTestId("chosen-file")).toHaveTextContent("<b>x</b>.csv");
    expect(container.querySelector("b")).toBeNull();
  });

  it("no_storage_on_error", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    POST.mockRejectedValue(apiErr("SHEET_NOT_PUBLIC"));
    setup();
    await toLink();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
